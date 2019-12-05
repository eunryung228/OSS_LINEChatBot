var express      = require("express");
var app          = express();
var cheerio = require('cheerio');
const line = require('@line/bot-sdk');
var request = require('request');
var https=require('https');
var http=require('http');


var fs = require("fs");

var httpsOptions = {
    hostname: 'oss.chatbot.bu.to',
    ca: fs.readFileSync('/etc/letsencrypt/live/oss.chatbot.bu.to/fullchain.pem'),
    key: fs.readFileSync('/etc/letsencrypt/live/oss.chatbot.bu.to/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/oss.chatbot.bu.to/cert.pem')
};

http.createServer(app).listen(80);
https.createServer(httpsOptions, app).listen(443);


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


var songList=[]; // list to store music(singer, song, lyric url)


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
  else if(event.message.text.substring(0, 5)=='차트 보기')
  {
    // music list 출력
    var url="https://www.genie.co.kr/chart/top200";

    request(url, function(error, response, html){
      var $ = cheerio.load(html);
      const $bodyList= $('#body-content > div.newest-list > div > table > tbody > tr');

      $bodyList.each(function(i, elem){
        if(i<20)
        {
          songList.push(
          {
            singer: $(this).find("td.info").find("a.artist.ellipsis").text().trim(),
            song: $(this).find("td.info").find("a.title.ellipsis").text().trim(),
            url: 'https://www.genie.co.kr/detail/songInfo?xgnm='+$(this).attr("songid")
          });
        }
        else
        {
          return;
        }
      });
      
    return new Promise(function(resolve, reject)
    {
      var result = { type: 'text', text:''};

        for(var i=0; i<songList.length; i++)
        {
            result.text+=i+1 + ". "+ songList[i].singer+" - "+songList[i].song+"\n";
        }
        console.log(result.text);
        client.replyMessage(event.replyToken, result).then(resolve).catch(reject);
    });
    });
  }
  else if(event.message.text.substring(0, 5)=='가사 검색')
  {
    var userNum=event.message.text[6]
    var newUrl=songList[userNum-1].url;
    var lyric='';

    request(newUrl, function(error, response, html)
    {
        var $ = cheerio.load(html);

        lyric=$('#pLyrics > p').text();
        lyric=lyric.substring(0, 150);

    return new Promise(function(resolve, reject)
    {
      //언어 감지 option
      var detect_options =
      {
        url : languagedetect_api_url,
        form : {'query': lyric},
        headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}
      };

      console.log(songList[userNum].song);
      console.log(lyric);
   
      //papago 언어 감지
      request.post(detect_options, (error,response,body)=>
      {
        if(!error && response.statusCode == 200)
        {
          var detect_body = JSON.parse(response.body);
          var source = '';
          var target = '';
          var result = { type: 'text', text:''};
  
          //언어 감지가 제대로 됐는지 확인
          console.log(detect_body.langCode);
  
          //번역은 한국어->영어 / 영어->한국어만 지원
          if(detect_body.langCode == 'ko'||detect_body.langCode == 'en')
          {
            source = detect_body.langCode == 'ko' ? 'ko':'en';
            target = source == 'ko' ? 'en':'ko';
            //papago 번역 option
            var options = {
                url:  translate_api_url,
                // 한국어(source : ko), 영어(target: en), 카톡에서 받는 메시지(text)
                form: {'source':source, 'target':target, 'text': lyric},
                headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}
            };
  
            // Naver Post API
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
          }
          // 메시지의 언어가 영어 또는 한국어가 아닐 경우
          else
          {
            result.text = '언어를 감지할 수 없습니다. \n 번역 언어는 한글 또는 영어만 가능합니다.';
            client.replyMessage(event.replyToken, result).then(resolve).catch(reject);
          }
        }
        else
        {
            console.log("status code is not 200");
        }
      });
    });
  });
  }
  else if (event.message.text.indexOf('http')!=-1) {
    return new Promise(async(resolve,reject)=>{  
      var uriBase = 'https://koreacentral.api.cognitive.microsoft.com/vision/v2.1/ocr';
      var imageUrl=event.message.text;
       var options = {
        uri: uriBase,
        qs: {
          'language': 'unk',
          'detectOrientation': 'true',
        },
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': '979dc5d63344438fa4701c62feebb7dc'
        },
      body:'{"url": ' + '"' + imageUrl + '"}',
      };
      
      request.post(options, function (error, response, body) {
        var data=JSON.stringify(body); 
        console.log(data);
        var text='';
        while(data.indexOf('text\\')!=-1)
        {
          data=data.substring(data.indexOf('text\\')+9);
          text+=data.substring(0,data.indexOf("\\"))+" ";
        }
        text=text.substring(text.length/10+1,text.length/8+2);
        text=text.replace(' ','');
        text=text.substr(0,text.indexOf(' '));
        console.log(text);
        var url="https://www.genie.co.kr/search/searchLyrics?query="+text;
          request(url, function(error, response, html)
          {
            console.log(url);
            var $ = cheerio.load(html);
            const $bodyList= $('#body-content > div.search_lyrics > div.music-list-wrap.type-lyrics > table > tbody > tr');
      
            var songs=[];
            $bodyList.each(function(i, elem){
              if(i<20){
                songs.push({
                  singer: $(this).find("td.info").find("a.artist.ellipsis").text().trim(),
                  song: $(this).find("td.info").find("a.title.ellipsis").text().trim(),
                });
              
              }
            })
            var resultm='';
            for(var i=0;i<songList.length;i++){
              if(songs[i].singer!=''){
                resultm+=songs[i].singer+", "+songs[i].song+"\n";
              }
            }
            var result = { type: 'text', text: resultm};
            client.replyMessage(event.replyToken,result).then(resolve).catch(reject);

          });
        });
  });
  }
  else{
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
}

app.get('/',(req,res)=>{
    res.send("hello");
})