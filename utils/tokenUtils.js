require('dotenv').config();
const jwt = require('jsonwebtoken');
const JWT_KEY = process.env.ACCESS_TOKEN_SECRET

// accessToken 발급 함수
exports.makeToken = (Object) =>{
    const token = jwt.sign(
        Object,  
        JWT_KEY
    );
    return token;
};

// access token 유효성 검사
exports.verify = (token) => {
    try {
      const decoded = jwt.verify(token, JWT_KEY);
      return {
        ok: true,
        id: decoded.id
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message,
      };
    }
  };

// // refreshToken 발급 함수
// exports.makeRefreshToken = () =>{
//     const refreshToken = jwt.sign(
//         {},  
//         JWT_KEY, 
//         {
//             algorithm: "HS256",
//             expiresIn: "10m"
//         }
//     );
//     console.log(refreshToken)
//     return refreshToken;
// };

// // refresh token 유효성 검사
// exports.refreshVerify = async (token, userId) => {

//   const sql = (email) =>{
//     return `select token from token where Email = '${email}';`
//   }
//   try {
//     // db에서 refresh token 가져오기(DB에 userID로 조회)
//     const result = await getConnection(sql(userId));

//     //받은 refreshToken과 DB에서 조회한 값이 일치하는지 확인
//     if (token === result['row'][0].token) {
//       try {
//         jwt.verify(token, JWT_KEY);
//         return true;

//       // refreshToken 검증 에러
//       } catch (err) {
//         return false;
//       }
//     } else {
//       return false;
//     }
//   // DB 에러
//   } catch (err) {
//     console.log(err);
//     return false;
//   }
// };
