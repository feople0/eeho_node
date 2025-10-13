const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const path = require("path");
require("dotenv").config();
// const app = express();

const multer = require("multer");
const multerS3 = require("multer-sharp-s3");

router.use(express.static(path.join(__dirname, "public")));

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY,
  secretAccessKey: process.env.AWS_SECRET,
  region: "ap-northeast-2",
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    Bucket: "eehoforum",
    ACL: "private", // 액세스 권한 설정
    Key: (req, file, cb) => {
      // 파일 이름 설정
      var dateString = WhatTimeNow();
      cb(null, dateString + file.originalname); //업로드시 파일명 변경가능
    },
    resize: {
      width: 600,
    },
    max: true, // 비율 유지
    format: "jpeg", // 변경할 이미지 포맷
    quality: 90, // 이미지 품질
  }),
});

// 인증번호 발송 api
const {
  emailAuth,
  emailFindAuth,
  emailLinkauth,
  sanitizeEmail,
} = require("../config/email"); // 경로는 적절하게 조정하세요

// email 인증용 메일 보내기
// body email
router.post("/verify-email", async (req, res) => {
  const originalEmail = req.body.email;
  const sanitizedEmail = sanitizeEmail(req.body.email);

  try {
    if (originalEmail != sanitizedEmail)
      return res.status(500).json({ ok: false, message: "Wrong Approach" });
    if (
      await req.app.db
        .collection("user")
        .findOne({
          PW: { $exists: true },
          provider: { $exists: false },
          email: req.body.email,
        })
    )
      return res
        .status(500)
        .json({
          ok: false,
          message: "이미 등록된 이메일입니다. 다시 확인해주세요.",
        });
    console.log(req.body);
    let result = await emailAuth(req, res);
    console.log(result);
    if (result)
      return res
        .status(200)
        .json({ ok: true, msg: "메일 전송에 성공하였습니다." });
    else
      return res
        .status(500)
        .json({ ok: false, msg: "메일 전송에 실패하였습니다." });
  } catch (error) {
    console.error("Error sending email:", error);
    return res
      .status(500)
      .json({ ok: false, message: "서버 오류로 메일 전송에 실패하였습니다." });
  }
});

// 인증번호 맞는지 확인하는 api
// body code, email
router.post("/verify-code", async (req, res) => {
  try {
    const filter = {
      email: req.body.email,
      code: Number(req.body.code),
      boolean: false,
    };
    if (await req.app.db.collection("user").findOne(filter)) {
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      await req.app.db
        .collection("user")
        .updateOne(filter, {
          $unset: { code: 1 },
          $set: { boolean: true, expires: expires },
        });
      return res
        .status(200)
        .json({ ok: true, message: "인증 성공 확인되었습니다." });
    }
    return res.status(500).json({ ok: false, message: "인증 성공 확인 실패." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ ok: false, message: "Internal Server Error", error: error });
  }
});

// 인증용 메일을 통해 접속한 링크에서 메일 인증하기
router.get("/verify-email", async (req, res) => {
  const { email, token } = req.query;

  const filter = { email: email, code: token, boolean: false };
  let result_user = await req.app.db.collection("user").findOne(filter);

  if (!result_user) {
    if (
      await req.app.db
        .collection("user")
        .findOne({ email: email, boolean: true })
    ) {
      return res.status(200).redirect("/new/user/verify-email/success");
    }
    return res.status(500).redirect("/new/user/verify-email/fail");
  }
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);

  await req.app.db
    .collection("user")
    .updateOne(filter, {
      $unset: { code: 1 },
      $set: { boolean: true, expires: expires },
    });

  return res.status(200).redirect("/new/user/verify-email/success");
});

// 메일 인증 성공했을 때 리다이렉트 이어줄 페이지.
router.get("/verify-email/success", (req, res) => {
  // index.html 파일을 클라이언트로 전송
  res.sendFile(path.join(__dirname, "../public", "success.html"));
});

// 메일 인증 성공했을 때 리다이렉트 이어줄 페이지.
router.get("/verify-email/fail", (req, res) => {
  // index.html 파일을 클라이언트로 전송
  res.sendFile(path.join(__dirname, "../public", "fail.html"));
});

// 인증번호 맞는지 확인하는 api -> email 통해서 인증 성공 후 누를 버튼 "인증완료" -> true되면 성공인 거로
// body email
router.post("/verify-complete", async (req, res) => {
  try {
    if (
      await req.app.db
        .collection("user")
        .findOne({ email: req.body.email, boolean: true })
    )
      return res
        .status(200)
        .json({ ok: true, message: "인증 성공 확인되었습니다." });
    return res.status(500).json({ ok: false, message: "인증 성공 확인 실패." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ ok: false, message: "Internal Server Error", error: error });
  }
});

// 다 됐을 시, 유저 생성하는 api => 회원가입?
// 그리고 우리 db 털릴 거 대비해서 password 해시 처리 후에 저장 => SHA256 사용
// 이메일, ID, PW, nickname, pushToken, signDate, img
const crypto = require("crypto");
const exp = require("constants");

function sha256Hash(input) {
  const hash = crypto.createHash("sha256");
  hash.update(input);
  return hash.digest("hex");
}

// [회원가입]
// 아이디 중복 검사 api
// body ID
router.post("/duplicate-ID", async (req, res) => {
  try {
    if (await req.app.db.collection("user").findOne({ ID: req.body.ID }))
      return res
        .status(500)
        .json({
          ok: false,
          message: "이미 등록된 ID입니다. 다시 시도해주세요.",
        });
    return res.status(200).json({ ok: true, message: "사용 가능한 ID입니다." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error", error: error });
  }
});

router.post("/register", upload.single("profile"), async (req, res) => {
  let dateToday = new Date();
  let fileLocation = process.env.Domain_Link + "/image/basic-profile-img.png";
  if (req.file) fileLocation = req.file.Location;
  const replacedString = fileLocation.replace(
    process.env.AWS_Link,
    process.env.Domain_Link + "/image/"
  );
  let filter = { email: req.body.email, boolean: true };

  if (!(req.body.userName && req.body.email && req.body.PW && req.body.ID))
    return res.status(400).json({ ok: false, message: "check your body" });
  console.log(req.body);
  if (await req.app.db.collection("user").findOne({ ID: req.body.ID }))
    return res.status(500).json({ ok: false, message: "Duplicated ID" });
  let result_user = await req.app.db.collection("user").findOne(filter);
  if (!result_user)
    return res.status(500).json({ ok: false, message: "check your email" });
  var data = {
    ID: req.body.ID,
    PW: sha256Hash(req.body.PW),
    userName: req.body.userName,
    profileImg: replacedString,
    pushToken: req.body.pushToken,
    signDate: dateToday,
  };
  await req.app.db
    .collection("user")
    .updateOne(filter, { $unset: { expires: 1, boolean: 1 }, $set: data });

  const accessToken = req.app.TokenUtils.makeToken({
    id: String(result_user._id),
  });
  return res.status(200).json({
    ok: true,
    token: accessToken,
  });
});

// [로그인]
// 아이디랑 비밀번호 들어오면, 아이디는 그냥 매칭되는지 확인 패스워드는 해시 하고 동일한지 확인 후에 ok -> true, false 주면 될 듯 + jwt 토큰도
router.post("/login", async (req, res) => {
  if (!(req.body.ID && req.body.PW))
    return res.status(400).json({ ok: false, message: "check your body" });

  let filter = { ID: req.body.ID, PW: sha256Hash(req.body.PW) };
  let result_user = await req.app.db.collection("user").findOne(filter);
  if (!result_user)
    return res.status(500).json({ ok: false, message: "fail to log in" });

  const accessToken = req.app.TokenUtils.makeToken({
    id: String(result_user._id),
  });
  return res.status(200).json({
    ok: true,
    token: accessToken,
  });
});

// email 인증용 메일 보내기
// body email
router.post("/find/verify-email", async (req, res) => {
  const originalEmail = req.body.email;
  const sanitizedEmail = sanitizeEmail(req.body.email);

  try {
    if (originalEmail != sanitizedEmail)
      return res.status(500).json({ ok: false, message: "Wrong Approach" });
    if (
      !(await req.app.db.collection("user").findOne({ email: originalEmail }))
    )
      return res.status(500).json({ ok: false, message: "cannot find email" });
    let result = await emailFindAuth(req, res, "email");

    if (result)
      return res
        .status(200)
        .json({ ok: true, msg: "메일 전송에 성공하였습니다." });
    else
      return res
        .status(500)
        .json({ ok: false, msg: "메일 전송에 실패하였습니다." });
  } catch (error) {
    console.error("Error sending email:", error);
    return res
      .status(500)
      .json({ ok: false, message: "서버 오류로 메일 전송에 실패하였습니다." });
  }
});

// 인증번호 맞는지 확인하는 api
// body code, email
router.post("/find/verify-code", async (req, res) => {
  try {
    const filter = {
      email: req.body.email,
      code: Number(req.body.code),
      type: "email",
      boolean: false,
    };
    if (await req.app.db.collection("verify").findOne(filter)) {
      await req.app.db.collection("verify").deleteOne(filter);
      let result_user = await req.app.db
        .collection("user")
        .findOne({ email: req.body.email });
      return res
        .status(200)
        .json({
          ok: true,
          user: result_user,
          message: "인증 성공 확인되었습니다.",
        });
    }
    return res.status(500).json({ ok: false, message: "인증 성공 확인 실패." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error", error: error });
  }
});

// email 인증용 메일 보내기
// body email
router.post("/setPW/verify-email", async (req, res) => {
  const originalEmail = req.body.email;
  const sanitizedEmail = sanitizeEmail(req.body.email);

  try {
    if (originalEmail != sanitizedEmail)
      return res.status(500).json({ ok: false, message: "Wrong Approach" });
    if (!(req.body.userName && req.body.email && req.body.ID))
      return res.status(400).json({ ok: false, message: "check your body" });
    let filter = {
      email: originalEmail,
      userName: req.body.userName,
      ID: req.body.ID,
    };
    if (!(await req.app.db.collection("user").findOne(filter)))
      return res.status(500).json({ ok: false, message: "cannot find data" });
    let result = await emailFindAuth(req, res, "pw");

    if (result)
      return res
        .status(200)
        .json({ ok: true, msg: "메일 전송에 성공하였습니다." });
    else
      return res
        .status(500)
        .json({ ok: false, msg: "메일 전송에 실패하였습니다." });
  } catch (error) {
    console.error("Error sending email:", error);
    return res
      .status(500)
      .json({ ok: false, message: "서버 오류로 메일 전송에 실패하였습니다." });
  }
});

// 인증번호 맞는지 확인하는 api
// body code, email
router.post("/setPW/verify-code", async (req, res) => {
  try {
    const filter = {
      email: req.body.email,
      code: Number(req.body.code),
      type: "pw",
      boolean: false,
    };
    if (await req.app.db.collection("verify").findOne(filter)) {
      await req.app.db.collection("verify").deleteOne(filter);
      return res
        .status(200)
        .json({ ok: true, message: "인증 성공 확인되었습니다." });
    }
    return res.status(500).json({ ok: false, message: "인증 성공 확인 실패." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error", error: error });
  }
});

// body email PW
router.post("/resetPW", async (req, res) => {
  try {
    const filter = { email: req.body.email };
    if (!(await req.app.db.collection("user").findOne(filter)))
      return res.status(500).json({ ok: false, message: "cannot find data" });
    await req.app.db
      .collection("user")
      .updateOne(filter, { $set: { PW: sha256Hash(req.body.PW) } });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error", error: error });
  }
});

/** 현재 시간 구하기 위한 함수. */
function WhatTimeNow() {
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var dateNum = date.getDate();
  var hour = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();
  var milsec = date.getMilliseconds();

  var dateString = year;
  if (month < 10) dateString += "0";
  dateString += String(month);
  if (dateNum < 10) dateString += "0";
  dateString += String(dateNum) + "_";
  if (hour < 10) dateString += "0";
  dateString += String(hour);
  if (min < 10) dateString += "0";
  dateString += String(min);
  if (sec < 10) dateString += "0";
  dateString += String(sec);
  if (milsec < 10) dateString += "00";
  else if (milsec < 100) dateString += "0";
  dateString += String(milsec) + "__";

  return dateString;
}

module.exports = router;
