const { async } = require('@firebase/util');
const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

router.post('/request', async (req, res) => { // ?member = 유저아이디
    // 1. 애호_리퀘스트 객체 생성 
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus) return res.status(500).json({ ok: false, message: "Access Token is necessary" });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user) return res.status(500).json({ ok: false, message: "cannot find user" });
    
    let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
    if(!result_find) return res.status(500).json({ ok: false, message: "cannot find family" });
    if(!req.body.member) return res.status(500).json({ ok: false, message: "member is required." });
    let receiver = req.body.member;
    // member 없으면 에러 리턴 !! 400으로 멤버 필요합니다. ok false message 가족을 선택해주세요!
    if (receiver.length === 0) return res.status(400).json({ ok: false, message: '가족을 선택해주세요!!!' });
    console.log(req.body);
    const somePushTokens = [];
    
    for (let i = 0; i < receiver.length; i++) {
        const foundData = (result_find.user).find(item => item.userId.toString() === (receiver[i]).toString());
        console.log(foundData);
        if(foundData) {
            await req.app.db.collection('EEHO_req').insertOne({ senderId : new ObjectId(loginStatus.id), receiverId : { userId : foundData.userId, userName : foundData.userName }, familyId : result_user.familyId, isCompleted : false });
            if (foundData.pushToken) somePushTokens.push(foundData.pushToken);
        } else {
            return res.status(500).json({ ok: false, message: 'wrong approach' });
        }
    }

    // 2. 푸시 알람 발송
    console.log(somePushTokens);
    req.app.notificationUtils(somePushTokens, `${result_user.userName}님이 에호 요청을 보냈습니다.`, { from: new ObjectId(loginStatus.id) }); // senderId를 넣었다 쳐. 사람 별로 조회가 왜 없어

    res.status(200).json({ ok: true });

    // 3. DB 저장.

});

module.exports = router;

