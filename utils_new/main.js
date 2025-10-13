const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

// router.get('/index', (req, res) => {

// });

// token이랑 groupId 보내기
router.post('/members', async (req, res) => { // 유저의 가족 멤버 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
	if (!result_user)
		return res.status(400).json({ ok: false, message: 'cannot find user' });
	if (!req.body.groupId)
		return res.status(400).json({ ok: false, message: 'check your body' });
	
	if(result_user.group)
		for (groupId of result_user.group) if (req.body.groupId.toString() == groupId.groupId.toString()) {
			let result_find = await req.app.db.collection('group').findOne({ _id: new ObjectId(req.body.groupId) });
			if (!result_find)
				return res.status(400).json({ ok: false, message: 'cannot find group' });
			
			var foundData = result_find.user;
			let newData = ((foundData).find(item => (item.userId.toString() === (loginStatus.id).toString())));
			foundData = ((foundData).filter(item => (item.userId.toString() !== (loginStatus.id).toString())));
			if (!req.query.exceptMe) { // 쿼리 데이터가 없으면 추가하고, 있으면 추가안하고. "true" "false" 
				foundData.splice(0, 0, newData);
			}
			
			return res.status(200).json({ ok : true, members: foundData, groupName: result_find.groupName });
			
		};
	return res.status(500).json({ ok : false, message: 'check your groupId' });
});

// DB에 저장된 가족 코드를 내려주기.
// token이랑 groupId 보내기
router.post('/get/token', async (req, res) => { // 유저의 알림 내역 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
	if (!result_user)
		return res.status(400).json({ ok: false, message: 'cannot find user' });
	if (!req.body.groupId)
		return res.status(400).json({ ok: false, message: 'check your body' });
	
	for (groupId of result_user.group) if (req.body.groupId.toString() == groupId.groupId.toString()) {
		let result_group = await req.app.db.collection('group').findOne({ _id: new ObjectId(result_user.group[0].groupId) });
		if (!result_group)
			return res.status(400).json({ ok: false, message: 'cannot find group data' });
		
		return res.status(200).json({ ok: true, data: result_group.code });
		
	};
	return res.status(500).json({ ok : false, message: 'check your groupId' });
    
});

// token이랑 groupId 보내기
router.post('/isCompleted', async (req, res) => { // 미응답된 리스트 전달
	// token 사용해서 user 식별 및 data 가져오기
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	if (!loginStatus)
		return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
	if (!result_user)
		return res.status(400).json({ ok: false, message: 'cannot find user data' });

	for (groupId of result_user.group) if (req.body.groupId.toString() == groupId.groupId.toString()) {
		// 가져온 user data의 familyId 사용해서 eeho_req의 data 가져오기 (isComplete : false, familyId, receiverId);
		try {
			let result_req = await req.app.db.collection('EEHO_req').find({
				isCompleted: false,
				"receiverId.userId": new ObjectId(loginStatus.id),
				groupId: new ObjectId(req.body.groupId)
			}, {
				projection: {
					receiverId: 1
				}
			}).toArray();
			return res.status(200).json({ ok: true, data: result_req });
		} catch (error) {
			return res.status(500).json({ ok: false, message: 'internal sever error', error: error });
		}
	};
	return res.status(500).json({ ok : false, message: 'check your groupId' });
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

router.post('/report', async (req, res) => { // token, body.topic, groupId
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
		group: req.body.groupId,
		userId: result_user._id,
		topic: req.body.topic,
		date: dateToday
	});
	
	if (result_report) return res.status(200).json({ ok: true });
	return res.status(500).json({ ok: false });
});

module.exports = router;

