const express = require('express');
const { ObjectId } = require('mongodb');
// const app = express();
const router = express.Router();
// const path = require('path');

router.get('/profile', async (req, res) => { // (개인 프로필 조회)
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if(!loginStatus) return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if(!result_user) return res.status(400).json({ ok: false, message: 'cannot find user' });
    try {
        delete result_user._id;
        delete result_user.pushToken;
        return res.status(200).json({ ok: true, data: result_user });
    } catch (error) {
        return res.status(500).json({ ok: false, message: 'internal server error' });
    }

});

// router.get('/logout', (req, res) => {
//     // let date = ;
//     console.log(new Date());
//     res.status(200).json({ ok: true });
// });

module.exports = router;

