var express      = require("express");
var app          = express();
const line = require('@line/bot-sdk');
var request = require('request');
var https=require('https');
var http=require('http');

/*
var fs = require("fs");

var httpsOptions = {
    hostname: 'oss.chatbot.bu.to',
    ca: fs.readFileSync('/etc/letsencrypt/live/oss.chatbot.bu.to/fullchain.pem'),
    key: fs.readFileSync('/etc/letsencrypt/live/oss.chatbot.bu.to/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/oss.chatbot.bu.to/cert.pem')
};

http.createServer(app).listen(80);
https.createServer(httpsOptions, app).listen(443);
*/
/*
const lex= require('greenlock-express').create({
  version: 'draft-11', // 버전2
  store: require('greenlock-store-fs'),
  configDir: '/etc/letsencrypt', // 또는 ~/letsencrypt/etc
  approveDomains: (opts, certs, cb) => {
    if (certs) {
      opts.domains = ['oss.chatbot.bu.to', 'www.oss.chatbot.bu.to'];
    } else {
      opts.email = 'sweun1@naver.com';
      opts.agreeTos = true;
    }
    cb(null, { options: opts, certs });

  },
  renewWithin: 81 * 24 * 60 * 60 * 1000,
  renewBy: 80 * 24 * 60 * 60 * 1000,
});
https.createServer(lex.httpsOptions, lex.middleware(app)).listen((process.env.SSL_PORT || 443),()=>{
    console.log("server on 443");
});
http.createServer(lex.middleware(require('redirect-https')())).listen(process.env.PORT || 80,()=>{
        console.log("server on 80");
});
*/
//papago api


//번역 api_url
var translate_api_url = 'https://openapi.naver.com/v1/papago/n2mt';

//언어감지 api_url
var languagedetect_api_url = 'https://openapi.naver.com/v1/papago/detectLangs'

// Naver Auth Key
//새로 발급받은 naver papago api id, pw 입력
var client_id = 'bIYcswH22VlQqT8OkkLm';
var client_secret = 'qLaERoks0u';

const config = {
  channelAccessToken: 'dWno95uZ/FLPM5BoTUIM1kPenQ+UsEHYSWphPWcOxyjS7eylg6jhocxvJCeV8YumuVvYf+3bE/696ZSkOPJitxhXbXDe+1p2WoyCbHzD8KxxF1EKo6zvHfnhsIA8kZS93lNzUTQr1FVWaMmRKl7NzwdB04t89/1O/w1cDnyilFU=',
  channelSecret: '75a2fd95ec26d716cac6fcdd520b9b9c'

};
// create LINE SDK client
const client = new line.Client(config);
// create Express app
// about Express itself: https://expressjs.com/

// register a webhook handler with middleware
// about the middleware, please refer to doc

// Creates a client
/* google-api
var vision = require('google-vision-api-client');

var requtil = vision.requtil;



//Prepare your service account from trust preview certificated project

var jsonfile = '/home/ubuntu/a/LINEBOT/googlevisionapikey.json';



//Initialize the api

vision.init(jsonfile);

//Build the request payloads
var d = requtil.createRequests().addRequest(
requtil.createRequest('/home/ubuntu/a/LINEBOT/photo/Fancy-TWICE.jpg')
.withFeature('TEXT_DETECTION', 3)
.build());
//Do query to the api server
vision.query(d, function(e, r, d){
if(e) console.log('ERROR:', e);
  console.log(JSON.stringify(d));
});

*/


app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err)=>{console.log(err);
    })
});
// event handler
function handleEvent(event) {
  console.log(event.message);
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
  return new Promise(function(resolve, reject) {
    //언어 감지 option
    var detect_options = {
      url : languagedetect_api_url,
      form : {'query': event.message.text},
      headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}
    };
    //papago 언어 감지
    request.post(detect_options, (error,response,body)=>{
      if(!error && response.statusCode == 200){
        var detect_body = JSON.parse(response.body);
        var source = '';
        var target = '';
        var result = { type: 'text', text:''};

        //언어 감지가 제대로 됐는지 확인
        console.log(detect_body.langCode);


        //번역은 한국어->영어 / 영어->한국어만 지원
        if(detect_body.langCode == 'ko'||detect_body.langCode == 'en'){
          source = detect_body.langCode == 'ko' ? 'ko':'en';
          target = source == 'ko' ? 'en':'ko';
          //papago 번역 option
          var options = {
              url:  translate_api_url,
              // 한국어(source : ko), 영어(target: en), 카톡에서 받는 메시지(text)
              form: {'source':source, 'target':target, 'text':event.message.text},
              headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}

          };

          // Naver Post API
          console.log("?!");
          request.post(options, function(error, response, body){
              // Translate API Sucess
              if(!error && response.statusCode == 200){
                  // JSON
                  var objBody = JSON.parse(response.body);
                  // Message 잘 찍히는지 확인

                  result.text = objBody.message.result.translatedText;
                  console.log("result: "+result.text);
                  //번역된 문장 보내기
                  client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
              }
          });
          console.log("?!")
        }
        // 메시지의 언어가 영어 또는 한국어가 아닐 경우
        else{
          result.text = '언어를 감지할 수 없습니다. \n 번역 언어는 한글 또는 영어만 가능합니다.';
          client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
        }

      }
      else{
          console.log("status code is not 200");
      }
      
      

    });

    });
  }
 app.listen(3000, function () {
  console.log('Linebot listening on port 3000!');
});
app.get('/',(req,res)=>{
    res.send("hellow");
})
