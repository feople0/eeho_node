const express = require('express');
// const app = express();
const router = express.Router();
// const path = require('path');

const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { async } = require('@firebase/util');
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
            dateString = dateString + '_' + req.user._id;
            // console.log(dateString);
            cb(null, dateString); //업로드시 파일명 변경가능
        }
    })
});

router.get('/index', async (req, res) => { // (사진 전체 응답) // calender, member 별 보관함에 사용
    let result = [];
    let res1 = await req.app.db.collection('EEHO').find({ senderId : (req.user._id) }).toArray()
    for(let i=0; i<res1.length; i++) {
        result.push(res1[i]);
    }
    res1 = await req.app.db.collection('EEHO').find({ receiverId : String(req.user._id) }).toArray();
    for(let i=0; i<res1.length; i++) {
        result.push(res1[i]);
    }
    result.sort(function(a, b) {
        return a._id - b._id;
    });
    // let result = await db.collection('user_login').findOne({ id : profile.id, provider : profile.provider });
    // console.log(result);
    res.render('album.ejs', { photos : result });
});

router.get('/:id', async (req, res) => {
    let result = await req.app.db.collection('EEHO').findOne({ _id : parseInt(req.params.id) });
    res.render('detailphoto.ejs', { photo : result });
})

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
//     // let result = await db.collection('user_login').findOne({ id : profile.id, provider : profile.provider });
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
//     // let result = await db.collection('user_login').findOne({ id : profile.id, provider : profile.provider });
//     // console.log(result);
//     res.render('album.ejs', { photos : result });
// });

router.get('/delete/:id', async (req, res) => {
    // console.log(req.app.db);
    console.log(req.user._id);
    let result = await req.app.db.collection('EEHO').deleteOne({ _id : parseInt(req.params.id), senderId : req.user._id });
    // console.log(에러.body);
    // 응답.status(400).send({ message : '삭제 실패'});

    if(result.deletedCount == 1) {
        console.log('삭제완료');
        res.redirect('/list?deleteSuccess=true');
    } else {
        console.log(result);
        res.redirect('/list?deleteSuccess=false');
    }
});

router.post('/upload', upload.single("profile"), async (req, res) => { // (이미지, 받는 사람 이름)
    var dateString = WhatTimeNow();
    let count = await req.app.db.collection('counter').findOne({ name : 'count_eeho' });
    let receiver = [];
    let sendEEHOId = req.body.sendEEHOId;
    receiver = sendEEHOId.split('!!!');
    // console.log(receiver);
    await req.app.db.collection('EEHO').insertOne({ _id : count.totalPost, senderId : req.user._id, receiverId : receiver, familyId : req.user.familyId, img : req.file.location, date : dateString });
    await req.app.db.collection('counter').updateOne({ name : 'count_eeho' }, { $inc : {totalPost : 1}});
    // console.log(result);
    res.redirect('/list?uploadSuccess=true');
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

module.exports = router;
