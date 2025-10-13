const nodemailer = require("nodemailer");
const crypto = require("crypto");
const TokenUtils = require("../utils/tokenUtils");
require("dotenv").config();

const smtpTransport = nodemailer.createTransport({
  pool: true,
  maxConnections: 1,
  service: "naver",
  host: "smtp.naver.com",
  port: process.env.EmailPort,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EmailUser,
    pass: process.env.EmailPass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const emailAuth = async (req, res) => {
  console.log(req.body);
  return new Promise((resolve, reject) => {
    const result = generateEmailVerificationToken();
    const number = generateRandomNumber(111111, 999999);

    const { email } = req.body;

    const mailOptions = {
      from: "sspp8585@naver.com",
      to: email,
      subject: "인증 관련 메일입니다.",
      html: "<h1>인증번호를 입력해주세요 \n\n\n\n\n\n\n\n\n\n</h1>" + number,
    };

    smtpTransport.sendMail(mailOptions, async (err, response) => {
      console.log("response", response);
      if (err) {
        reject(err);
        // smtpTransport.close();
        return { ok: false, message: "메일 전송에 실패하였습니다." };
      } else {
        console.log("email", email);
        if (await req.app.db.collection("user").findOne({ email: email })) {
          req.app.db
            .collection("user")
            .updateOne(
              { email: email },
              {
                $set: { code: number, expires: result.expires, boolean: false },
              }
            );
        } else {
          req.app.db.collection("user").insertOne({
            email: email,
            code: number,
            expires: result.expires,
            boolean: false,
          });
        }
        resolve(result);
        // smtpTransport.close();
        return { ok: true, msg: "메일 전송에 성공하였습니다." };
      }
    });
  });
};

const emailFindAuth = async (req, res, type) => {
  console.log(req.body);
  return new Promise((resolve, reject) => {
    const result = generateEmailVerificationToken();
    const number = generateRandomNumber(111111, 999999);

    const { email } = req.body;

    const mailOptions = {
      from: "sspp8585@naver.com",
      to: email,
      subject: "인증 관련 메일입니다.",
      html: "<h1>인증번호를 입력해주세요 \n\n\n\n\n\n\n\n\n\n</h1>" + number,
    };

    smtpTransport.sendMail(mailOptions, async (err, response) => {
      // console.log('response', response)
      if (err) {
        reject(err);
        // smtpTransport.close();
        return { ok: false, message: "메일 전송에 실패하였습니다." };
      } else {
        // console.log('email', email);
        if (
          await req.app.db
            .collection("verify")
            .findOne({ email: email, type: type })
        ) {
          req.app.db
            .collection("verify")
            .updateOne(
              { email: email, type: type },
              {
                $set: { code: number, expires: result.expires, boolean: false },
              }
            );
        } else {
          req.app.db.collection("verify").insertOne({
            email: email,
            code: number,
            expires: result.expires,
            type: type,
            boolean: false,
          });
        }
        resolve(result);
        // smtpTransport.close();
        return { ok: true, msg: "메일 전송에 성공하였습니다." };
      }
    });
  });
};

var generateRandomNumber = function (min, max) {
  var randNum = Math.floor(Math.random() * (max - min + 1)) + min;
  return randNum;
};

const emailLinkauth = (req, res) => {
  console.log(req.body);
  return new Promise((resolve, reject) => {
    const result = generateEmailVerificationToken();

    const { email } = req.body;
    const mailOptions = {
      from: "sspp8585@naver.com",
      to: email,
      subject: "이메일 인증하기",
      html: `<h3>이메일 주소를 확인하려면 다음 링크를 클릭하세요:</h3>
			<p> <a href="https://feople-eeho.com/new/user/verify-email?email=${email}&token=${result.token}">이메일 인증하기</a></p>
			<p>이 링크는 다음 날짜에 만료됩니다. ${result.expires}</p>`,
    };

    smtpTransport.sendMail(mailOptions, async (err, response) => {
      console.log("response", response);
      if (err) {
        reject(err);
        // smtpTransport.close();
        return { ok: false, message: "메일 전송에 실패하였습니다." };
      } else {
        console.log("email", email);
        if (await req.app.db.collection("user").findOne({ email: email })) {
          req.app.db
            .collection("user")
            .updateOne(
              { email: email },
              {
                $set: {
                  code: result.token,
                  expires: result.expires,
                  boolean: false,
                },
              }
            );
        } else {
          req.app.db.collection("user").insertOne({
            email: email,
            code: result.token,
            expires: result.expires,
            boolean: false,
          });
        }
        resolve(result);
        // smtpTransport.close();
        return { ok: true, msg: "메일 전송에 성공하였습니다." };
      }
    });
  });
};

const generateEmailVerificationToken = () => {
  // crypto.randomBytes(20).toString('hex');
  const token = crypto.randomBytes(20).toString("hex");
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + 5);
  return { token, expires };
};

// const decodeToken = (token) => {
// 	try {
// 	  const decoded = TokenUtils.verify(token);
// 	  return decoded;
// 	} catch (error) {
// 	  // 토큰이 유효하지 않은 경우 또는 서명이 일치하지 않는 경우
// 	  console.error('Error decoding token:', error);
// 	  return null;
// 	}
//   };

// Custom sanitization function to remove special characters from email
const sanitizeEmail = (value) => {
  // Remove special characters using a regular expression
  return value.replace(/[!#$%^&*()+{}\[\]:;<>,?~\\/-]/g, "");
};

module.exports = {
  smtpTransport,
  emailAuth, // 확인: 이 부분이 함수로 정의되어 있는지 다시 확인하세요.
  emailLinkauth,
  sanitizeEmail,
  emailFindAuth,
};
