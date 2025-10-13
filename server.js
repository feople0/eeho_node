const express = require("express");
const app = express();
const { MongoClient } = require("mongodb");
const cors = require("cors");
const TokenUtils = require("./utils/tokenUtils");
const notificationUtils = require("./utils/notificationUtil.js");
app.TokenUtils = TokenUtils;
app.notificationUtils = notificationUtils;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: [
      "https://eeho-web.vercel.app",
      "http://localhost:3000",
      "http://172.16.231.51:3000",
      "http://172.16.238.147:3000",
      "http://192.168.45.232:3000",
      "https://d663-180-69-92-15.ngrok-free.app",
    ], // 모든 출처 허용 옵션. true 를 써도 된다.
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// env 파일 연결.
require("dotenv").config();

// mongoDB 연결
let db;
const url = process.env.DB_URL;
new MongoClient(url)
  .connect()
  .then((client) => {
    db = client.db("EEHO");
    app.db = db;
    // 서버 오픈
    app.listen(process.env.PORT);
    console.log(process.env.PORT);
  })
  .catch((err) => {
    console.log(err);
  });

function checkLogin(req, res, next) {
  let loginStatus = TokenUtils.verify(req.headers.token);
  if (loginStatus.ok) {
    next();
  } else {
    res.status(500).json({ ok: false, message: loginStatus.message });
  }
}

const routes_family = require("./utils/family.js");
app.use("/family", routes_family);

const routes_member = require("./utils/member.js");
app.use("/member", checkLogin, routes_member);

const routes_main = require("./utils/main.js");
app.use("/main", checkLogin, routes_main);

const routes_EEHO = require("./utils/EEHO.js");
app.use("/eeho", checkLogin, routes_EEHO);

const routes_album = require("./utils/album.js");
app.use("/album/image", checkLogin, routes_album);

app.get("/image/:imageName", (req, res) => {
  const imageName = req.params.imageName;
  const s3ImageUrl = process.env.AWS_Link + imageName;
  res.redirect(s3ImageUrl);
});

app.get("/index", (req, res) => {
  res.send("<h1>Hello World!8000</h1>");
});

const routes_user_new = require("./utils_new/user.js");
app.use("/new/user", routes_user_new);

const routes_group_new = require("./utils_new/group.js");
app.use("/new/group", checkLogin, routes_group_new);

const routes_member_new = require("./utils_new/member.js");
app.use("/new/member", checkLogin, routes_member_new);

const routes_main_new = require("./utils_new/main.js");
app.use("/new/main", checkLogin, routes_main_new);

const routes_EEHO_new = require("./utils_new/EEHO.js");
app.use("/new/eeho", checkLogin, routes_EEHO_new);

const routes_album_new = require("./utils_new/album.js");
app.use("/new/album/image", checkLogin, routes_album_new);

const routes_comment_new = require("./utils_new/comment.js");
app.use("/new/comment", checkLogin, routes_comment_new);

const path = require("path");

// 정적 파일을 서비스하기 위한 미들웨어 등록
app.use(express.static(path.join(__dirname, "public")));

// GET 요청에 대한 라우트 설정
app.get("/", (req, res) => {
  // index.html 파일을 클라이언트로 전송
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// GET 요청에 대한 라우트 설정
app.get("/guide/page", (req, res) => {
  // index.html 파일을 클라이언트로 전송
  res.sendFile(path.join(__dirname, "public", "guide.html"));
});

var qs = require("qs");
var axios = require("axios");

app.post("/kakao/code", async (req, res) => {
  const code = req.query.code;
  const uri = "https://kauth.kakao.com/oauth/token";
  const body = qs.stringify({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_API,
    code: code,
  });
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
  };
  var token;
  await axios
    .post(uri, body, headers)
    .then((res1) => {
      token = res1.data.access_token;
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json(error);
    });

  const uri_token = "https://kapi.kakao.com/v2/user/me";
  const response_token = await axios.get(uri_token, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response_token.data) {
    console.log(response_token);
    let result = await db
      .collection("user")
      .findOne({ ID: response_token.data.id, provider: "kakao" });
    if (!result) {
      // 회원가입
      // if (await db.collection('user').findOne({ email: response_token.data.kakao_account.email }))
      //     return res.status(500).json({ ok: false, message: 'Dupicated Email' });
      let res2 = await db.collection("user").insertOne({
        email: response_token.data.kakao_account.email,
        ID: response_token.data.id,
        provider: "kakao",
        profileImg: process.env.Domain_Link + "/image/basic-profile-img.png",
        // profileImg: response_token.data.properties.profile_image,
        pushToken: req.body.pushToken,
        signDate: new Date(),
        userName: response_token.data.kakao_account.profile.nickname,
      });
      if (!res2) {
        console.log("error...! data 저장 실패.");
        return res.status(500).json({ message: "signup fail" });
      } else {
        console.log("카카오 회원가입 성공");
        const accessToken = TokenUtils.makeToken({
          id: String(res2.insertedId),
        });
        return res
          .status(200)
          .json({ ok: true, message: "signup success", token: accessToken });
      }
    } else {
      // 로그인
      console.log("카카오 로그인 성공");
      const accessToken = TokenUtils.makeToken({ id: String(result._id) });
      return res
        .status(200)
        .json({ ok: true, message: "login success", token: accessToken });
    }
  } else {
    console.log("로그인 실패...!");
    return res.status(500).json({ message: "login fail" });
  }
});

const jwt = require("jsonwebtoken");
const { getAppleToken } = require("./config/appleSignIn.js");

app.post("/apple/code", async (req, res) => {
  const { code, id_token, pushToken } = req.body;
  console.log(req.body);

  const data = await getAppleToken(code);
  console.log(jwt.decode(id_token));
  console.log(data);
  const { sub: id, email } = jwt.decode(id_token) || {};
  if (id) {
    let result = await db
      .collection("user")
      .findOne({ ID: id, provider: "apple" });
    if (!result) {
      // 회원가입
      // if (await db.collection('user').findOne({ email: email }))
      //     return res.status(500).json({ ok: false, message: 'Dupicated Email' });
      let res2 = await db.collection("user").insertOne({
        email: email,
        ID: id,
        provider: "apple",
        profileImg: process.env.Domain_Link + "/image/basic-profile-img.png",
        pushToken: pushToken,
        signDate: new Date(),
        // userName: response_token.data.kakao_account.profile.nickname,
      });
      if (!res2) {
        console.log("error...! data 저장 실패.");
        return res.status(500).json({ message: "signup fail" });
      } else {
        console.log("애플 회원가입 성공");
        const accessToken = TokenUtils.makeToken({
          id: String(res2.insertedId),
        });
        return res
          .status(200)
          .json({ ok: true, message: "signup success", token: accessToken });
      }
    } else {
      // 로그인
      console.log("애플 로그인 성공");
      const accessToken = TokenUtils.makeToken({ id: String(result._id) });
      return res
        .status(200)
        .json({ ok: true, message: "login success", token: accessToken });
    }
  } else {
    console.log("로그인 실패...!");
    return res.status(500).json({ ok: false, message: "login fail" });
  }
});
