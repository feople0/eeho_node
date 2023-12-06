const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
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
            cb(null, (dateString + file.originalname)); //업로드시 파일명 변경가능
        }
    })
});

router.get('/profile', async (req, res) => { // (개인 프로필 조회)
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user)
        return res.status(400).json({ ok: false, message: 'cannot find user' });
    let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    if (!result_user)
        return res.status(400).json({ ok: false, message: 'cannot find family' });
    let user = ((result_find.user).find(item => (item.userId.toString() === (loginStatus.id).toString())));
    try {
        if(!user) throw new SyntaxError("불완전한 데이터: 유저를 찾을 수 없음.");
        delete result_user._id, result_user.pushToken, result_user.signDate;
        result_user.role = user.role;
        result_user.profileImg = user.profileImg;
        result_user.familyName = result_find.familyName;
        
        return res.status(200).json({ ok: true, data: result_user });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error, message: 'internal server error' });
    }

});

// 유저 id를 사용해서 유저 정보를 전부 조회하고 내려보내기
// post -> body { userId: "123" }
router.post('/user/info', async (req, res) => { // body : userId
    // 1. req.body.userId => 사용해서 user 정보 조회하기.
    if (!(req.body.userId))
        return res.status(400).json({ ok: false, message: 'check your body again' });
    let result_find = await req.app.db.collection('user').findOne({ _id : new ObjectId(req.body.userId) }); //String에서 ObjectId로 형변환
    // 2. 조회한 data가 있으면 json형식으로 데이터 보내주기.
    if (result_find)
        return res.status(200).json({ ok: true, userInformation: result_find });
    return res.status(400).json({ ok: false, message: 'cannot find user'});
    // 3. error handling.

});

router.post('/account/update', upload.single('profileImg'), async (req, res) => { // userName, role, profileImg
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_find = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) }); //String에서 ObjectId로 형변환
     
    try {
        let result_family = await req.app.db.collection('family').findOne({ _id: (result_find.familyId) });
        let checkName = ((result_family.user).find(item => (item.userName.toString() === (req.body.userName).toString())));
        if(req.body.userName.toString() === result_find.userName.toString());
        else if(checkName)
            return res.status(500).json({ok:false, message:"duplicate"});
        
        let user = ((result_family.user).find(item => (item.userId.toString() === (loginStatus.id).toString())));
        let filePath = user.profileImg;
        if (req.file) filePath = req.file.location;
        
        await req.app.db.collection('user').updateOne({ _id: new ObjectId(loginStatus.id) }, {
            $set: {
                userName: req.body.userName
            }
        });
        await req.app.db.collection('family').updateOne({ _id: (result_find.familyId) }, {
            $set: {
                "user.$[elem].userName": req.body.userName,
                "user.$[elem].role": req.body.role,
                "user.$[elem].profileImg": filePath
            }
        }, { arrayFilters: [{ "elem.userId": new ObjectId(loginStatus.id) }] });
        
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'internal server error', error: err });
    }
});

router.get('/account/delete', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user)
        return res.status(500).json({ ok: false, message: 'cannot find user' });
    let result_family = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    if (!result_family)
        return res.status(500).json({ ok: false, message: 'cannot find family' });

    if ((result_family.familyCount) <= 1)
        req.app.db.collection('family').deleteOne({ _id: result_user.familyId });
    else {
        await req.app.db.collection('family').findOneAndUpdate({ _id: result_user.familyId }, {
            $pull: {
                user: {
                    userId: new ObjectId(loginStatus.id)
                }
            }
        });
        await req.app.db.collection('family').updateOne({ _id: result_user.familyId }, {
            $inc: {
                familyCount: -1
            }
        });
    }
    try {
        await req.app.db.collection('user').deleteOne({ _id: new ObjectId(loginStatus.id) });
        await req.app.db.collection('EEHO').deleteMany({ senderId: result_user._id });
        
        return res.status(200).json({ ok: true });
    } catch (err) {
        if (!result_family)
            return res.status(500).json({ ok: false, message: 'internal server error', error: err });
    }
});

router.get('/logout', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user)
        return res.status(500).json({ ok: false, message: 'cannot find user' });

    try {
        await req.app.db.collection('user').updateOne({ _id: new ObjectId(loginStatus.id) }, { $set: { pushToken: null } });
        await req.app.db.collection('family').updateOne({ _id: result_user.familyId }, {
            $set: {
                "user.$[elem].pushToken": null
            }
        }, { arrayFilters: [{ "elem.userId": new ObjectId(loginStatus.id) }] });
        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false });
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
    if(month < 10) dateString += "0";
    dateString += String(month);
    if(dateNum < 10) dateString += "0";
    dateString += String(dateNum) + "_";
    if(hour < 10) dateString += "0";
    dateString += String(hour);
    if(min < 10) dateString += "0";
    dateString += String(min);
    if(sec < 10) dateString += "0";
    dateString += String(sec);
    if(milsec < 10) dateString += "00";
    else if(milsec < 100) dateString += "0";
    dateString += String(milsec) + "__";

    return dateString;
}

module.exports = router;

