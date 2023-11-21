const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
require('dotenv').config();

const multer = require('multer');
const multerS3 = require('multer-sharp-s3');
const { ObjectId } = require('mongodb');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
    region: 'ap-northeast-2',
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        Bucket: 'eehoforum',
        ACL: 'private', // 액세스 권한 설정
        Key: (req, file, cb) => {
            // 파일 이름 설정
            var dateString = WhatTimeNow();
            let loginStatus = req.app.TokenUtils.verify(req.headers.token);
            dateString = dateString + '_' + loginStatus.id + '.jpeg';
            cb(null, dateString);
        },
        resize: {
            width: 100,
            withoutEnlargement: true
        },
        max: true, // 비율 유지
        format: 'jpeg', // 변경할 이미지 포맷
        quality: 90 // 이미지 품질
    })
});
  
// 유저가 속한 가족의 모든 이미지를 가져오기
router.get('/index', async (req, res) => { // (사진 전체 응답) // calender, member 별 보관함에 사용
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus) return res.status(500).json({ ok: false, message: "AccessToken is required" });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    let res1 = await req.app.db.collection('EEHO').find({ familyId : result_user.familyId }).toArray();
    return res.status(200).json({ ok: true, photos: res1 });
});

router.get('/index/user', async (req, res) => { // header의 토큰으로 접근
    // 1. 토큰 사용해서 user data 조회하기
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus) return res.status(500).json({ ok: false, message: "AccessToken is required" });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });

    // 2. user data 사용해서, family member 조회하기 // userId, role, userName, profileImg, pushToken -> token, name, role 지우고 photos:[] 추가.
    let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    const foundData = result_find.user;
    
    var a;
    for(let i=0; i<foundData.length; i++) {
        if ((foundData[i].userId).toString() === (loginStatus.id).toString()) {
            a = i;
            continue;
        }
        delete foundData[i].role;
        // delete foundData[i].profileImg;
        delete foundData[i].pushToken;
        foundData[i].photo = [];
    }
    foundData.splice(a, 1);

    let result = await req.app.db.collection('EEHO').find({ familyId: result_user.familyId, senderId: (new ObjectId(loginStatus.id)) }).toArray();
    let res1 = await req.app.db.collection('EEHO').find({ familyId: result_user.familyId, "receiverId.userId" : (new ObjectId(loginStatus.id)) }).toArray();
    for(let i=0; i<res1.length; i++) {
        let index = 0;
        while(index < result.length && result[index]._id < res1[i]._id) index++;
        result.splice(index, 0, res1[i]);
    }

    const userIdMap = new Map();
    for(let i=0; i<foundData.length; i++) userIdMap.set(foundData[i].userId.toString(), i);
    
    for(const res of result) {
        if((res.senderId.toString()) === (loginStatus.id.toString())) {
            for(let i=0; i<res.receiverId.length; i++) {
                var index = userIdMap.get(res.receiverId[i].userId.toString());
                (foundData[index].photo).push(res.img);
            }
            continue;
        }
        var index = userIdMap.get(res.senderId.toString());
        foundData[index].photo.push(res.img);
    }
    
    for (let i = 0; i < foundData.length; i++) foundData[i].photo.reverse();

    res.status(200).json({ ok: true, data: foundData });

});

router.get('/:id', async (req, res) => {
    let result = await req.app.db.collection('EEHO').findOne({ _id : parseInt(req.params.id) });
    return res.status(200).json({ ok: true, photo : result });
});

router.get('/delete/:id', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    let result;
    if(loginStatus.id) result = await req.app.db.collection('EEHO').deleteOne({ _id : parseInt(req.params.id), senderId : new ObjectId(loginStatus.id) });

    if(result.deletedCount == 1) {
        return res.status(200).json({ ok: true, id: req.params.id });
    } else {
        return res.status(500).json({ ok: false });
    }
});

// 사진 한장 받을 때 쓰는 거
router.post('/upload', upload.single("profile"), async (req, res) => { // (이미지, 받는 사람 ID)
    // 1. 에호 객체 생성
    var dateString = WhatTimeNow();
    let count = await req.app.db.collection('counter').findOne({ name : 'count_eeho' });

    let receiver = (req.body.receiverIds);
    if (!receiver) return res.status(400).json({ ok: false, message: "user ID is required" });
    receiver = JSON.parse(receiver);
    console.log(receiver);
    console.log(receiver.length);
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if(!loginStatus) return res.status(400).json({ ok: false, message: "Access Token is necessary" });
    let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
    if(!result_user) return res.status(500).json({ ok: false, message: "cannot find user" });
    let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    if(!result_find) return res.status(500).json({ ok: false, message: "cannot find family" });

    const foundData = [];
    // for (let i = 0; i < receiver.length; i++) foundData.push((result_find.user).find(item => (item.userId.toString() === (receiver[i]).toString())));
    for (let i = 0; i < receiver.length; i++) {
        for (const data of result_find.user) {
            if (receiver[i].toString() === data.userId.toString()) {
                foundData.push(data);
                break;
            }
        }
    }
    
    if (foundData.length === 0) return res.status(500).json({ ok: false, message: '사진 전송에 실패했습니다. 보낼 가족을 선택해주세요.' });
    for(let i=0; i<foundData.length; i++) {
        delete foundData[i].role;
        delete foundData[i].profileImg;
    }

    if (req.file.length === 0) return res.status(500).json({ ok: false, message: '사진이 전송에 실패했습니다. 다시 시도해주세요.' });
    try {
        const replacedString = (req.file.Location).replace(process.env.AWS_Link, process.env.Domain_Link + '/image/');
        await req.app.db.collection('EEHO').insertOne({
            _id: count.totalPost,
            senderId: new ObjectId(loginStatus.id),
            receiverId: foundData,
            familyId: result_user.familyId,
            img: replacedString,
            date: dateString
        });
        await req.app.db.collection('counter').updateOne({ name : 'count_eeho' }, { $inc : {totalPost : 1}});
    } catch (error) {
        return res.status(500).json({ ok: false, message: "internal server error", error : error });
    }

    // 2. 에호_리퀘스트 true 로 변경 // senderId : foundData[i].userId, isCompleted : false, receiverId.userId : loginStatus.id, familyId : result_user.familyId
    let response_data = [];
    for(let i=0; i<foundData.length; i++) {
        let result_isComplete = await req.app.db.collection('EEHO_req').findOne({
            senderId: foundData[i].userId,
            isCompleted: false,
            'receiverId.userId': new ObjectId(loginStatus.id),
            familyId: result_user.familyId
        })
        if(result_isComplete) {
            let result_update = await req.app.db.collection('EEHO_req').updateOne({ _id : result_isComplete._id }, { $set : { isCompleted : true } });
            if(!(result_update.modifiedCount)) return res.status(500).json({ ok: false, message: "cannot update DB" });
            else response_data.push(result_isComplete.senderId);
        }
    }
    
    // 3. 푸시 알림 전송
    const somePushTokens = [];
    const pushReceiver = [];
    for (let i = 0; i < foundData.length; i++) {
        pushReceiver.push(foundData[i].userId);
        if (foundData[i].pushToken) somePushTokens.push(foundData[i].pushToken);
    }
    
    let user = ((result_find.user).find(item => (item.userId.toString() === (loginStatus.id).toString())));
    var pushText = `${result_user.userName}님의 에호 사진이 도착했습니다.`;
    console.log(user);
    if(user.role) if((user.role).toString() === ('아빠').toString() || (user.role).toString() === ('엄마').toString()) pushText = `${user.role}님의 에호 사진이 도착했습니다.`;
    req.app.notificationUtils(somePushTokens, pushText); // senderId를 넣었다 쳐. 사람 별로 조회가 왜 없어

    // 3. DB 저장.
    // id, date, body, senderId, text
    try {
        for(const receiver of pushReceiver) await req.app.db.collection('notification').insertOne({ date : new Date(), receiverId : receiver, text : pushText });
        return res.status(200).json({ ok: true, change: response_data });
    } catch (error) {
        return res.status(500).json({ ok: false, message: "internal server error", error : error });
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

    var dateString = year;
    if(month < 10) dateString += "0";
    dateString += String(month);
    if(dateNum < 10) dateString += "0";
    dateString += String(dateNum) + '_';
    if(hour < 10) dateString += "0";
    dateString += String(hour);
    if(min < 10) dateString += "0";
    dateString += String(min);
    if(sec < 10) dateString += "0";
    dateString += String(sec);

    return dateString;
}

// // // 유저가 받거나 전송한 이미지만 가져오기
// router.get('/index', async (req, res) => { // (사진 전체 응답) // calender, member 별 보관함에 사용
//     let loginStatus = req.app.TokenUtils.verify(req.headers.token);
//     if (!loginStatus) return res.status(500).json({ ok: false, message: "AccessToken is required" });
//     let result = [];
//     let res1 = await req.app.db.collection('EEHO').find({ senderId: (new ObjectId(loginStatus.id)) }).toArray();
//     for(let i=0; i<res1.length; i++) {
//         result.push(res1[i]);
//     }
//     res1 = await req.app.db.collection('EEHO').find({ receiverId : String(new ObjectId(loginStatus.id)) }).toArray();
//     for(let i=0; i<res1.length; i++) {
//         result.push(res1[i]);
//     }
//     result.sort(function(a, b) {
//         return a._id - b._id;
//     });
//     // let result = await db.collection('user').findOne({ id : profile.id, provider : profile.provider });
//     // console.log(result);
//     return res.status(200).json({ ok: true, photos: result });
// });

// router.get('/date', async (req, res) => { // ?date=YYYYMMDD
//     console.log(req.query.date);
//     let result = [];
//     var search = new RegExp(`${req.query.date}`);
//     console.log(search);
//     let res1 = await req.app.db.collection('EEHO').find({ date : search, senderId : (req.user._id) }).toArray()
//     for(let i=0; i<res1.length; i++) {
//         result.push(res1[i]);
//     }
//     res1 = await req.app.db.collection('EEHO').find({ date : search, receiverId : String(req.user._id) }).toArray();
//     for(let i=0; i<res1.length; i++) {
//         result.push(res1[i]);
//     }
//     result.sort(function(a, b) {
//         return a._id - b._id;
//     });
//     // let result = await db.collection('user').findOne({ id : profile.id, provider : profile.provider });
//     console.log(result);
//     res.render('album.ejs', { photos : result });

// });

// router.get('/member', async (req, res) => { // member=유저이름
//     console.log(req.query.member);
//     let result = [];
//     let res1 = await req.app.db.collection('EEHO').find({ senderId : (req.user._id), receiver : req.query.member }).toArray()
//     for(let i=0; i<res1.length; i++) {
//         result.push(res1[i]);
//     }
//     res1 = await req.app.db.collection('EEHO').find({ senderId : new ObjectId(req.query.member), receiverId : String(req.user._id) }).toArray();
//     for(let i=0; i<res1.length; i++) {
//         result.push(res1[i]);
//     }
//     result.sort(function(a, b) {
//         return a._id - b._id;
//     });
//     // let result = await db.collection('user').findOne({ id : profile.id, provider : profile.provider });
//     // console.log(result);
//     res.render('album.ejs', { photos : result });
// });

module.exports = router;
