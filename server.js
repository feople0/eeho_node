const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');
const cors = require('cors');
const axios = require('axios');
const qs = require('qs');
const TokenUtils = require('./utils/tokenUtils');
app.TokenUtils = TokenUtils;
const notificationUtils = require('./utils/notificationUtil.js');
app.notificationUtils = notificationUtils;
const jwt = require('jsonwebtoken');

app.use(express.json());
app.use(express.urlencoded({extended:true})) ;
app.use(cors({
    origin: '*', // 모든 출처 허용 옵션. true 를 써도 된다.
    credential: true // 사용자 인증이 필요한 리소스(쿠키 ..등) 접근
}));

// mongoDB 연결
let db;
const url = process.env.DB_URL;
new MongoClient(url).connect().then( (client) => {
    db = client.db('EEHO');
    app.db = db;
    // 서버 오픈
    app.listen(process.env.PORT, () => {
        console.log('http://localhost:' + process.env.PORT + ' 에서 서버 실행중');
    });
}).catch((err)=>{
    console.log(err);
});

// env 파일 연결.
require('dotenv').config();

function checkLogin(req, res, next) {
    let loginStatus = TokenUtils.verify(req.headers.token);
    console.log('checkLogin');
    console.log(loginStatus);
    if(loginStatus.ok) {
        next();
    } else {
        res.status(500).json({ ok: false, message: loginStatus.message });
    }
};

const routes_family = require('./utils/family.js');
app.use('/family', routes_family);

const routes_member = require('./utils/member.js');
app.use('/member', checkLogin, routes_member);

const routes_main = require('./utils/main.js');
app.use('/main', checkLogin, routes_main);

const routes_EEHO = require('./utils/EEHO.js');
app.use('/eeho', checkLogin, routes_EEHO);

const routes_album = require('./utils/album.js');
app.use('/album/image', checkLogin, routes_album);







app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));










































// // 불러오기 API ( 아이디가 속한 가족 리스트업 )

// // 최초에 메인 페이지 접속 시에 로딩되는 페이지를 위한 API
// app.get('/list', checkLogin, async (req, res) => {
//     // console.log(db);
//     let result = await db.collection('family').findOne({ _id : new ObjectId(req.user.familyId) });
//     // console.log(result.member.length);

//     let data = [];
//     for(let i=0; i<result.member.length; i++) {
//         let res = await db.collection('user').findOne({ _id : result.member[i].user });
//         data.push(res);
//     }
//     // console.log(data);
//     data.code = req.user.familyId;
//     res.render('list.ejs', { posts : data });
// });

// // 회원가입, 로그인 ( 카카오톡 사용 시 하나의 api로 서버 내 분류 후 처리 가능 )
// // Session 방식으로 로그인을 위한 라이브러리
// const passport = require('passport');
// const KakaoStrategy = require('passport-kakao').Strategy;
// const session = require('express-session');
// // 미들웨어
// app.use(session({secret : 'secret-code', resave : true, secure : false, saveUninitialized: false, cookie : { maxAge : 2 * 60 * 60 * 1000 }}));
// app.use(passport.initialize());
// app.use(passport.session());

// passport.use('kakao-login', new KakaoStrategy({
//     clientID: process.env.KAKAO_API,
//     callbackURL: '/auth/kakao/callback',
// }, async (accessToken, refreshToken, profile, done) => {
//     console.log(accessToken + "\n-------");
//     // console.log(profile);

//     if (profile) {
//         let result = await db.collection('user').findOne({ id : profile.id, provider : profile.provider });
//         if(!(result)) { // 회원가입
//             let res = await db.collection('user').insertOne( { id : profile.id, provider : profile.provider, profileImg : profile._json.properties.profile_image });
//             if(!res) {
//                 console.log('error...! data 저장 실패.');
//             } else {
//                 console.log('카카오 회원가입 성공');
//                 res.message = "signup success";
//                 return done(null, res);
//             }
//         } else { // 로그인
//             console.log('카카오 로그인 성공');
//             result.message = "login success";
//             return done(null, result);
//         }
//     } else {
//         console.log('로그인 실패...!');
//         return done(null, false, { message: '카카오 로그인 실패.' });
//     }
// }));

// app.get("/api/kakao/code", async (req, res) => {
//     const code = req.query.code;
//     const uri = "https://kauth.kakao.com/oauth/token";
//     const body = qs.stringify({
//         grant_type: "authorization_code",
//         client_id: process.env.KAKAO_API,
//         code: code,
//     });
//     const headers = {
//         "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
//     };
//     var token;
//     await axios.post(uri, body, headers).then((res1) => {
//             token = (res1.data.access_token);
//     }).catch((error) => {
//         console.log(error);
//         res.status(500).json(error);
//     });
    
//     const uri_token = "https://kapi.kakao.com/v2/user/me";
//     const response_token = await axios.get(uri_token, { headers: {
//                 "Content-Type": "application/x-www-form-urlencoded",
//                 "Authorization": `Bearer ${token}`
//     }});
    
//     // console.log(response_token.data);
    
//     const accessToken = TokenUtils.makeToken({ id: String(response_token.data.id) });
    
//     if (response_token.data) {
//         // console.log(response_token.data);
//         let result = await db.collection('user').findOne({ id : response_token.data.id });
//         if(!(result)) { // 회원가입
//             let res2 = await db.collection('user').insertOne({ id : response_token.data.id, profileImg : response_token.data.properties.profile_image, email : response_token.data.kakao_account.email });
//             if(!res2) {
//                 console.log('error...! data 저장 실패.');
//                 return res.status(500).json({ message : "signup fail" });
//             } else {
//                 console.log('카카오 회원가입 성공');
//                 return res.status(200).json({ message : "signup success", token : accessToken });
//             }
//         } else { // 로그인
//             console.log('카카오 로그인 성공');
//             return res.status(200).json({ message : "login success", token : accessToken });
//         }
//     } else {
//         console.log('로그인 실패...!');
//         return res.status(500).json({ message : "login fail" });
//     }
// });

// // 카카오 로그인 페이지로 이동
// app.get('/kakao', function(req, res, next) {
//     passport.authenticate('kakao-login', (error, user, info) => {
//         if (error) return res.status(500).json(error);
//         if (!user) return res.status(401).json(info.message);
//         req.logIn(user, (err) => {
//           if (err) return next(err);
//           res.redirect('/login');
//         });
//     })(req, res, next);
  
//     // // 로그인 성공
//     // console.log('로그인 성공');
//     // // res.status(200).send({ message: '로그인 성공' });
//     // res.redirect('/list');
// });

// // 카카오 로그인 콜백
// app.get('/auth/kakao/callback', passport.authenticate('kakao-login', {
//     failureRedirect: '/login',
// }), (req, res) => {
//     if(req.user.message == 'login success') {
//         res.redirect('/list');
//     } else if(req.user.message == 'signup success') {
//         res.redirect('/register');
//     } else {
//         res.status(500).send({ message : 'login error' });
//     }
// });

// passport.serializeUser(async (user, done) => {
//     if(user.insertedId) {
//         let result = await db.collection('user').findOne({ _id : (user.insertedId) });
//         result.message = 'signup success';
//         user = result;
//     }
//     process.nextTick(() => {
//         done(null, { id: user._id });
//     });
// });

// passport.deserializeUser(async (user, done) => {
//     let result = await db.collection('user').findOne({ _id : new ObjectId(user.id) });
//     if(result) delete result.id;
//     process.nextTick(() => {
//         return done(null, result);
//     });
// });




// // 알림 전송 API ( 추후 설명 추가 ) ------------------------------------------------------------------------------------------------------------------------------------------------------------------


























































// // // // // // // // 수정 API ( 기존 가족 멤버에서 수정할 내용 ex. 가족 별명, 가족 내 위치 ) ------------------------------------------------------------------------------------------------------------------------------------------------------------------

// // // // // // // // 삭제 API ( 가족 탭 전체 삭제 ) ------------------------------------------------------------------------------------------------------------------------------------------------------------------

// // // // // // // // 멤버 삭제 API ( 가족 내 개인 삭제 ) ------------------------------------------------------------------------------------------------------------------------------------------------------------------

// // // // // // // // 약관 동의 저장 API. ( post 방식으로 약관 동의 여부 data 저장 ) ------------------------------------------------------------------------------------------------------------------------------------------------------------------




// // Import the functions you need from the SDKs you need
// // import { initializeApp } from "firebase/app";
// // import { getAnalytics } from "firebase/analytics";
// // import { getMessaging, getToken } from "firebase/messaging";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// // const firebaseConfig = {
// //   apiKey: process.env.FIREBASE_API,
// //   authDomain: process.env.FIREBASE_DOMAIN,
// //   projectId: process.env.FIREBASE_PROJECT,
// //   storageBucket: process.env.FIREBASE_STORAGE,
// //   messagingSenderId: process.env.FIREBASE_ID,
// //   appId: process.env.FIREBASE_APP,
// //   measurementId: process.env.FIREBASE_MEASUREMENT
// // };

// // Initialize Firebase
// // app = initializeApp(firebaseConfig);

// // const admin = require("firebase-admin");

// // let serviceAccount = require(process.env.FILE_NAME);

// // admin.initializeApp({
// //     credential: admin.credential.cert(serviceAccount),
// // });

// // Initialize Firebase Cloud Messaging and get a reference to the service
// // const messaging = getMessaging();

// // app.get('/push', () => {
// //     let deviceToken = ''
    
// //     let message = {
// //         notification: {
// //             title: '테스트 발송💛',
// //             body: '망고플레이트 앱 확인해보세요!💚',
// //         },
// //         token: deviceToken,
// //     }
      
// //     // Add the public key generated from the console here.
// //     getToken(messaging, { vapidKey: process.env.GOOGLE_VAPIDKEY }).then((currentToken) => {
// //         if (currentToken) {
// //           // Send the token to your server and update the UI if necessary
// //           // ...
// //           console.log('Successfully sent message: : ', response);
// //           return res.status(200).json({success : true});
// //         } else {
// //           // Show permission request UI
// //           console.log('No registration token available. Request permission to generate one.');
// //           // ...
// //         }
// //     }).catch((err) => {
// //         console.log('Error Sending message!!! : ', err)
// //         return res.status(400).json({ success : false })
// //         // ...
// //     });
    
// // });

// // TODO: Replace the following with your app's Firebase project configuration
// // See: https://firebase.google.com/docs/web/learn-more#config-object
// // const firebaseConfig = {
// //     apiKey: process.env.FIREBASE_API,
// //     authDomain: process.env.FIREBASE_DOMAIN,
// //     projectId: process.env.FIREBASE_PROJECT,
// //     storageBucket: process.env.FIREBASE_STORAGE,
// //     messagingSenderId: process.env.FIREBASE_ID,
// //     appId: process.env.FIREBASE_APP,
// //     measurementId: process.env.FIREBASE_MEASUREMENT
// // };
// // admin.initializeApp(firebaseConfig);
// // const request = require('request');

// // Initialize Firebase Cloud Messaging and get a reference to the service
// const admin = require("firebase-admin");
// let serviceAccount = require(process.env.FILE_NAME);
// const fcm_admin = admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });


// app.get('/push/send', (req, res, next) => {
//     // 파베 접근해서 token을 받아온다.
//     var key=[];
//     var token=[];

//     // 파베 접근해서 token을 받아온다.
//     firebase.database().ref("Token").on('value', (snapshot)=>{
//         val = snapshot.val();
//         console.log(val);
        
//         //키값들을 받는다.
//         key = Object.keys(val);
        
//         // 토큰값을 받는다.
//         token = Object.values(val);
        
//         console.log(key);
//         console.log(token);
//     });

//     var registrationToken = '';
    
//     var message = {
//         notification: {
//             title: '시범 데이터 발송',
//             body: '클라우드 메시지 전송이 잘 되는지 확인하기 위한, 메시지 입니다.'
//         },
//         token: registrationToken
//     };

//     fcm_admin.messaging().send(message).then((response) => {
//         // Response is a message ID string.
//         console.log('Successfully sent message:', response);
//     })
//     .catch((error) => {
//         console.log('Error sending message:', error);
//     });

// });

// // 메시지 형식
// // "to" : "[디바이스 토큰 값]", 
// // "priority" : "high", 
// // "notification" : { 
// //    "title" : "BackGround Title", 
// //    "body" : "Background Message"
// // }, 
// // "data" : { 
// //    "title" : "ForeGround Title", 
// //    "body" : "Foreground Message" 
// // }



// // app.get('/push', () => {
// //     let deviceToken = '';
    
// //     let message = {
// //         notification: {
// //             title: '테스트 발송💛',
// //             body: '망고플레이트 앱 확인해보세요!💚',
// //         },
// //         token: deviceToken,
// //     };
    
// //     // Add the public key generated from the console here.
// //     getToken(messaging, { vapidKey: process.env.GOOGLE_VAPIDKEY }).then((currentToken) => {
// //         if (currentToken) {
// //           // Send the token to your server and update the UI if necessary
// //           // ...
// //           console.log('Successfully sent message: : ', response);
// //           return res.status(200).json({success : true});
// //         } else {
// //           // Show permission request UI
// //           console.log('No registration token available. Request permission to generate one.');
// //           // ...
// //         }
// //     }).catch((err) => {
// //         console.log('Error Sending message!!! : ', err);
// //         return res.status(400).json({ success : false });
// //         // ...
// //     });
    
// // });

// app.use('/album/image', require('./utils/album.js'));