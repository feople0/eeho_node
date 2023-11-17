const express = require('express');
// const app = express();
const router = express.Router();
// const path = require('path');

router.get('/profile', (req, res) => { // (개인 프로필 조회)
    // console.log(req.user);
});

router.get('/logout', (req, res) => {
    // let date = ;
    console.log(new Date());
    res.status(200).json({ message : 'login success' });
});

module.exports = router;

