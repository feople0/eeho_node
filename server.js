const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');

app.use(express.json());
app.use(express.urlencoded({extended:true})) ;

// env 파일 연결.
require('dotenv').config();
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

// mongoDB 연결
let db;
const url = process.env.DB_URL;
const ObjectId = require('mongodb').ObjectId;
new MongoClient(url).connect().then( (client) => {
    db = client.db('EEHO');
    // 서버 오픈
    app.listen(process.env.PORT, () => {
        console.log('http://localhost:' + process.env.PORT + ' 에서 서버 실행중');
    });
}).catch((err)=>{
    console.log(err);
});

// 회원가입, 로그인 ( 카카오톡 사용 시 하나의 api로 서버 내 분류 후 처리 가능 )
// Session 방식으로 로그인을 위한 라이브러리
const passport = require('passport');
const KakaoStrategy = require('passport-kakao').Strategy;
const session = require('express-session');
// 미들웨어
app.use(session({secret : 'secret-code', resave : true, secure : false, saveUninitialized: false, cookie : { maxAge : 2 * 60 * 60 * 1000 }}));
app.use(passport.initialize());
app.use(passport.session());

passport.use('kakao-login', new KakaoStrategy({
    clientID: process.env.KAKAO_API,
    callbackURL: '/auth/kakao/callback',
}, async (accessToken, refreshToken, profile, done) => {
    // console.log(accessToken + "\n-------");
    // console.log(profile);

    if (profile) {
        let result = await db.collection('user_login').findOne({ id : profile.id, provider : profile.provider });
        if(!(result)) { // 회원가입
            let res = await db.collection('user_login').insertOne( { id : profile.id, provider : profile.provider, profileImg : profile._json.properties.profile_image });
            if(!res) {
                console.log('error...! data 저장 실패.');
            } else {
                console.log('카카오 회원가입 성공');
                res.message = "signup success";
                return done(null, res);
            }
        } else { // 로그인
            console.log('카카오 로그인 성공');
            result.message = "login success";
            return done(null, result);
        }
    } else {
        console.log('로그인 실패...!');
        return done(null, false, { message: '카카오 로그인 실패.' });
    }
}));

// 카카오 로그인 페이지로 이동
app.get('/kakao', function(req, res, next) {
    passport.authenticate('kakao-login', (error, user, info) => {
        if (error) return res.status(500).json(error);
        if (!user) return res.status(401).json(info.message);
        req.logIn(user, (err) => {
          if (err) return next(err);
          res.redirect('/login');
        });
    })(req, res, next);
  
    // // 로그인 성공
    // console.log('로그인 성공');
    // // res.status(200).send({ message: '로그인 성공' });
    // res.redirect('/list');
});

// 카카오 로그인 콜백
app.get('/auth/kakao/callback', passport.authenticate('kakao-login', {
    failureRedirect: '/login',
}), (req, res) => {
    if(req.user.message == 'login success') {
        res.redirect('/list');
    } else if(req.user.message == 'signup success') {
        res.redirect('/register');
    } else {
        res.status(500).send({ message : 'login error' });
    }
});

passport.serializeUser(async (user, done) => {
    if(user.insertedId) {
        let result = await db.collection('user_login').findOne({ _id : (user.insertedId) });
        result.message = 'signup success';
        user = result;
    }
    process.nextTick(() => {
        done(null, { id: user._id });
    });
});

passport.deserializeUser(async (user, done) => {
    let result = await db.collection('user_login').findOne({ _id : new ObjectId(user.id) });
    if(result) delete result.id;
    process.nextTick(() => {
        return done(null, result);
    });
});

// 로그아웃 요청 시 처리함수
app.get('/logout', (req, res) => {
    // 세션 파기 (또는 삭제)
    req.session.destroy(err => {
        if (err) {
            console.error('세션 파기 실패:', err);
            res.status(500).send('세션 파기 실패');
        } else {
            res.redirect('/login'); // 로그아웃 후 리다이렉트할 페이지 설정
        }
    });
});

// test
app.get('/login', function(req, res) {
    res.render('login.ejs');
});

// test
app.get('/register', checkLogin, function(req, res) {
    res.render('register.ejs');
});

// 신규 회원가입 시 필요한 데이터를 로컬에서 저장할 때 받는 데이터
// name, nick, gender, familyLocation, phone
app.post('/register', checkLogin, async (req, res) => {
    let data = await db.collection('user_login').findOne({ _id : new ObjectId(req.user._id) });

    if((data)) {
        await db.collection('user_login').updateOne( {}, { $set: { username : req.body.name, nickname : req.body.nick, gender : req.body.gender, familyLocation : req.body.familyLocation, phone : req.body.phone } });
        res.status(200).send({ message : '성공했습니다!' });
    } else {
        res.status(400).send({ message : 'ID 중복'});
    }
});

// // test
// app.get('/', (req, res) => {
//     res.send('반갑다');
// });

// // test
// app.get('/news', (req, res)=>{
//     db.collection('EEHO').insertOne({ title : '어쩌구', content : '저쩌구' });
//     res.send('news');
// });

// test
app.get('/list', checkLogin, async (req, res) => {
    requestPermission();
    let result = await db.collection('EEHO').find().toArray();
    res.render('list.ejs', { posts : result });
});

function checkLogin(req, res, next) {
    if (req.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// 약관 동의 저장 API. ( post 방식으로 약관 동의 여부 data 저장 )

// 가족 탭 생성 API ( 신규 생성 )

// 불러오기 API ( 아이디가 속한 가족 리스트업 )

// 수정 API ( 기존 가족 멤버에서 수정할 내용 ex. 가족 별명, 가족 내 위치 )

// 삭제 API ( 가족 탭 전체 삭제 )

// 멤버 삭제 API ( 가족 내 개인 삭제 )

// 초대 API ( 기존 가족에서 초대 코드 보내기 )

// 추가 API ( 기존 가족에 초대 URI 혹은 코드 사용하여 멤버 추가 )

// 사진 저장 API ( 전달받은 사진 서버 내 저장 )

// 사진 삭제 API ( 올린 사람에 한하여 삭제 가능 )

// 사진 불러오기 API ( 전달받은 쿼리문 사용하여 불러오기 ex. 개인, 날짜, 전체 )

// 알림 전송 API ( 추후 설명 추가 )




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