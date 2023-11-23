const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

// router.get('/index', (req, res) => {

// });

router.get('/members', async (req, res) => { // 유저의 가족 멤버 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
	if (!result_user)
		return res.status(400).json({ ok: false, message: 'cannot find user' });

	let result_find;
	if (result_user.familyId)
		result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
	if (!result_find)
		return res.status(400).json({ ok: false, message: 'cannot find family' });
	
	const foundData = result_find.user;
	if (req.query.exceptMe) {
		var a;
		for(let i=0; i<foundData.length; i++) {
			if ((foundData[i].userId).toString() === (loginStatus.id).toString()) {
				a = i;
				break;
			}
		}
		foundData.splice(a, 1);
	}
	return res.status(200).json({ ok : true, members: foundData, familyName: result_find.familyName });
});

// DB에 저장된 가족 코드를 내려주기.
router.get('/get/token', async (req, res) => { // 유저의 알림 내역 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
	let result_family = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
	
	return res.status(200).json({ ok: true, data: result_family.code });
    
});

router.get('/isCompleted', async (req, res) => { // 미응답된 리스트 전달
	// token 사용해서 user 식별 및 data 가져오기
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
	if (!result_user)
		return res.status(400).json({ ok: false, message: 'cannot find user data' });

	// 가져온 user data의 familyId 사용해서 eeho_req의 data 가져오기 (isComplete : false, familyId, receiverId);
	try {
		let result_req = await req.app.db.collection('EEHO_req').find({
			isCompleted: false,
			"receiverId.userId": new ObjectId(loginStatus.id),
			familyId: result_user.familyId
		}).toArray();
		return res.status(200).json({ ok: true, data: result_req });
	} catch (error) {
        return res.status(500).json({ ok: false, message: 'internal sever error', error: error });
	}
});

// DB에 저장된 알림을 내려주기.
router.get('/notice', async (req, res) => { // 유저의 알림 내역 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_noti = await req.app.db.collection('notification').find({
		receiverId: new ObjectId(loginStatus.id)
	}).toArray();
	for(const noti of result_noti) {
		delete noti.receiverId;
		delete noti._id;
	}
	return res.status(200).json({ ok: true, data: result_noti });
    
});

router.post('/report', async (req, res) => { // token, body.topic
	if (!req.body.topic)
		return res.status(400).json({ ok: false, message: 'topic is required' });
	let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
	if (!result_user)
		return res.status(400).json({ ok: false, message: 'cannot find user data' });

	let dateToday = new Date();
	let result_report = await req.app.db.collection('report').insertOne({
		familyId: result_user.familyId,
		userId: result_user._id,
		topic: req.body.topic,
		date: dateToday
	});
	
	if (result_report) return res.status(200).json({ ok: true });
	return res.status(500).json({ ok: false });
});

module.exports = router;

