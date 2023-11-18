const { async } = require('@firebase/util');
const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

router.get('/request', async (req, res) => { // ?member = 유저이름
    // 1. 애호_리퀘스트 객체 생성 
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
    
    let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    let receiver = req.query.member;
    const arr = receiver.split(',').map(item => item.trim().replace('[', '').replace(']', ''));
    
    for (let i = 0; i < arr.length; i++) {
        const foundData = (result_find.user).find(item => item.userName.toString() === (arr[i]).toString());
        console.log(foundData);
        if(foundData) {
            await req.app.db.collection('EEHO_req').insertOne({ senderId : new ObjectId(loginStatus.id), receiverId : { userId : foundData.userId, userName : foundData.userName }, familyId : result_user.familyId, isCompleted : false });
            
        } else {
            res.status(500).json({ ok: false, message: 'wrong approach' });
        }
    }

    res.status(200).json({ ok: true });
    // 2. 푸시 알람 발송

});

module.exports = router;

