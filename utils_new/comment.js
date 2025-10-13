const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
require('dotenv').config();

// [코멘트 (댓글)]
// 코멘트 도큐먼트 생성
// -userId
// -날짜
// -message
// -eehoId(사진 아이디)

// token, eehoId, message
router.post('/create', async (req, res) => { // (가족이름) (groupName)
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus) return res.status(500).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user) return res.status(500).json({ ok: false, message: 'cannot find user' });
    let dateToday = new Date();
    
	var data = { userId: result_user._id, userName: result_user.userName, profileImg: result_user.profileImg, comment: req.body.comment, date: dateToday, eehoId: req.body.eehoId };
    let result_insert = await req.app.db.collection('comment').insertOne(data);
    
    if (!result_insert) return res.status(500).json({ ok: false, message: "cannot insert group data" });
	try {
		let post = await req.app.db.collection('EEHO').findOne({ _id: req.body.eehoId });
		console.log(post);
		const pushReceiver = post.senderId;
		post = await req.app.db.collection('user').findOne({ _id: post.senderId });
		console.log(post);
		const somePushTokens = post.pushToken;
		var pushText = `${result_user.userName}: ${req.body.comment}`;
		if(somePushTokens) req.app.notificationUtils(somePushTokens, pushText, { from: req.body.eehoId });
		console.log(post);
		await req.app.db.collection('notification').insertOne({
			date: new Date(), receiverId: pushReceiver, text: pushText, groupId: new ObjectId(req.body.groupId)
		});
        
        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false, message: 'internal sever error', error: error });
    }
});

// 사진 아이디 파라미터나 바디로 받으면, 그에 대한 코멘트 모두 찾아서 내려주는 api 필요
router.post('/index', async (req, res) => {
    let res1 = await req.app.db.collection('comment').find({ eehoId: req.body.eehoId }, {
		projection: {
			userName: 1,
			profileImg: 1,
			comment: 1,
		}
	}).toArray();
    return res.status(200).json({ ok: true, photos: res1 });
});

// 코멘트 자기꺼면 삭제하는 거 api 필요 (앨범에서 사진 삭제랑 비슷하게 가면 될 듯)
router.post('/delete', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus.id) return res.status(400).json({ ok: false, message: 'token is required' });
    let result = await req.app.db.collection('comment').deleteOne({
            _id: new ObjectId(req.body.id), userId: new ObjectId(loginStatus.id)
	});
	console.log(result);
    if(result.deletedCount == 1) {
        return res.status(200).json({ ok: true });
    } else {
        return res.status(500).json({ ok: false });
    }
});

// 코멘트 자기꺼면 수정하는 거 api 필요 (위와 동일)
router.post('/update', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus.id) return res.status(400).json({ ok: false, message: 'token is required' });
	
	let filter = { _id: new ObjectId(req.body.id), userId: new ObjectId(loginStatus.id) };
	let result = await req.app.db.collection('comment').updateOne(filter, {
		$set: { comment: req.body.comment }
	});
	
    if(result.matchedCount == 1) {
        return res.status(200).json({ ok: true });
    } else {
        return res.status(500).json({ ok: false });
    }
});

module.exports = router;
