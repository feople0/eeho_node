const { async } = require('@firebase/util');
const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

router.get('/request', async (req, res) => { // ?member = 유저이름
    // 1. 애호_리퀘스트 객체 생성 
    console.log(req.query.member);
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    console.log(loginStatus);
    let result_user = await req.app.db.collection('user_login').findOne({ _id : new ObjectId(loginStatus.id) });
    console.log(result_user);
    let result_find = await req.app.db.collection('family').findOne({ _id : result_user.familyId });
    const foundData = (result_find.user).find(item => item.userName.toString() === (req.query.member).toString());
    console.log(foundData);
    if(foundData) {
        await req.app.db.collection('EEHO_req').insertOne({ senderId : new ObjectId(loginStatus.id), receiverId : { userId : foundData.userId, userName : req.query.member }, familyId : result_user.familyId, isComplete : false });
        res.status(200).json({ message : 'Request Success' });
    } else {
        res.status(500).json({ message : 'wrong approach' });
    }

    // 2. 푸시 알람 발송

});

module.exports = router;

