const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

// router.get('/index', (req, res) => {

// });

router.get('/members', async (req, res) => { // 유저의 가족 멤버 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
	
	if (!result_user) {
		res.status(500).json({ ok: false, message: 'cannot find user' });
	}

	let result_find = await req.app.db.collection('family').findOne({ _id: result_user.familyId });
	
	if (!result_find) {
		res.status(500).json({ ok: false, message: 'cannot find family' });
	}
	
	res.status(200).json({ ok : true, data: result_find.user });
});

router.get('/isCompleted', async (req, res) => { // 미응답된 리스트 전달
	// token 사용해서 user 식별 및 data 가져오기
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    let result_user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) });
	if (!result_user) res.status(500).json({ ok: false, message: 'cannot find user data' });

	// 가져온 user data의 familyId 사용해서 eeho_req의 data 가져오기 (isComplete : false, familyId, receiverId);
	try {
		let result_req = await req.app.db.collection('EEHO_req').find({ isCompleted: false, "receiverId.userId" : new ObjectId(loginStatus.id), familyId: result_user.familyId }).toArray();
		res.status(200).json({ ok: true, data: result_req });
	} catch (error) {
        res.status(500).send({ ok: false, message: 'internal sever error', error: error });
	}
});

// DB에 저장된 알림을 내려주기.
router.get('/notice', async (req, res) => { // 유저의 알림 내역 응답
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    let result_noti = await req.app.db.collection('notification').find({ receiverId : new ObjectId(loginStatus.id) }).toArray();
	for(const noti of result_noti) {
		delete noti.receiverId;
		delete noti._id;
	}
	res.status(200).json({ok: true, data: result_noti});
    
});

module.exports = router;

