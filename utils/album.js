const express = require('express');
const router = express.Router();

const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { ObjectId } = require('mongodb');
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.AWS_KEY,
      secretAccessKey : process.env.AWS_SECRET
  }
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'eehoforum',
        key: function (req, file, cb) {
            var dateString = WhatTimeNow();
            let loginStatus = req.app.TokenUtils.verify(req.headers.token);
            dateString = dateString + '_' + loginStatus.id;
            // console.log(dateString);
            cb(null, dateString); //업로드시 파일명 변경가능
        }
    })
});

router.get('/index', async (req, res) => { // (사진 전체 응답) // calender, member 별 보관함에 사용
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    let result = [];
    let res1 = await req.app.db.collection('EEHO').find({ senderId : (new ObjectId(loginStatus.id)) }).toArray()
    for(let i=0; i<res1.length; i++) {
        result.push(res1[i]);
    }
    res1 = await req.app.db.collection('EEHO').find({ receiverId : String(new ObjectId(loginStatus.id)) }).toArray();
    for(let i=0; i<res1.length; i++) {
        result.push(res1[i]);
    }
    result.sort(function(a, b) {
        return a._id - b._id;
    });
    // let result = await db.collection('user').findOne({ id : profile.id, provider : profile.provider });
    // console.log(result);
    res.status(200).json({ ok: true, photos: result });
});

router.get('/:id', async (req, res) => {
    let result = await req.app.db.collection('EEHO').findOne({ _id : parseInt(req.params.id) });
    res.status(200).json({ ok: true, photo : result });
});

router.get('/delete/:id', async (req, res) => {
    // console.log(req.app.db);
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    let result = await req.app.db.collection('EEHO').deleteOne({ _id : parseInt(req.params.id), senderId : new ObjectId(loginStatus.id) });
    // console.log(에러.body);
    // 응답.status(400).send({ message : '삭제 실패'});

    if(result.deletedCount == 1) {
        console.log('삭제완료');
        res.status(200).json({ ok: true });
    } else {
        console.log(result);
        res.status(500).json({ ok: false });
    }
});

router.post('/upload', upload.single("profile"), async (req, res) => { // (이미지, 받는 사람 이름) 
    // 1. 에호 객체 생성
    var dateString = WhatTimeNow();
    let count = await req.app.db.collection('counter').findOne({ name : 'count_eeho' });

    let sendEEHOId = req.body.sendEEHOId;
    if(!sendEEHOId) return res.status(500).json({ ok: false, message: "eeho ID is required" });
    const receiver = sendEEHOId.split(',').map(item => item.trim().replace('[', '').replace(']', '')); // [ 'testMember2', 'testMember3' ]
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if(!loginStatus) return res.status(500).json({ ok: false, message: "Access Token is necessary" });
    let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
    if(!result_user) return res.status(500).json({ ok: false, message: "cannot find user" });
    let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    if(!result_find) return res.status(500).json({ ok: false, message: "cannot find family" });

    const foundData = [];
    for(let i=0; i<receiver.length; i++) foundData.push((result_find.user).find(item => item.userName.toString() === (receiver[i]).toString()));
    for(let i=0; i<foundData.length; i++) {
        delete foundData[i].role; 
        delete foundData[i].profileImg;
    }

    try {
        await req.app.db.collection('EEHO').insertOne({ _id : count.totalPost, senderId : new ObjectId(loginStatus.id), receiverId : foundData, familyId : result_user.familyId, img : req.file.location, date : dateString });
        await req.app.db.collection('counter').updateOne({ name : 'count_eeho' }, { $inc : {totalPost : 1}});
    } catch (error) {
        return res.status(500).json({ ok: false, message: "internal server error", error : error });
    }

    // 2. 에호_리퀘스트 true 로 변경 // senderId : foundData[i].userId, isCompleted : false, receiverId.userId : loginStatus.id, familyId : result_user.familyId
    let response_data = [];
    for(let i=0; i<foundData.length; i++) {
        let result_isComplete = await req.app.db.collection('EEHO_req').findOne({ senderId : foundData[i].userId, isCompleted : false, 'receiverId.userId' : new ObjectId(loginStatus.id), familyId : result_user.familyId })
        if(result_isComplete) {
            let result_update = await req.app.db.collection('EEHO_req').updateOne({ _id : result_isComplete._id }, { $set : { isCompleted : true } });
            if(!(result_update.modifiedCount)) return res.status(500).json({ ok: false, message: "cannot update DB" });
            else response_data.push(result_isComplete.senderId);
        }
    }

    res.status(200).json({ ok: true, change: response_data });
    // 3. 푸시 알림 전송
});

// router.post('/upload', upload.single("profile"), async (req, res) => { // (이미지, 받는 사람 이름)
//     var dateString = WhatTimeNow();
//     let count = await req.app.db.collection('counter').findOne({ name : 'count_eeho' });
//     let receiver = [];
//     let sendEEHOId = req.body.sendEEHOId;
//     receiver = sendEEHOId.split('!!!');
//     // console.log(receiver);
//     await req.app.db.collection('EEHO').insertOne({ _id : count.totalPost, senderId : req.user._id, receiverId : receiver, familyId : req.user.familyId, img : req.file.location, date : dateString });
//     await req.app.db.collection('counter').updateOne({ name : 'count_eeho' }, { $inc : {totalPost : 1}});
//     // console.log(result);
//     res.status(200).json({ ok: true });
// });

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
