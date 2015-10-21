'use strict';
/*!
 * Module dependencies.
 */
var request = require('request');
var fs = require('fs');
var crypto = require('crypto');

var AlipayConfig = {
  //↓↓↓↓↓↓↓↓↓↓请在这里配置您的基本信息↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
  // 合作身份者ID，以2088开头由16位纯数字组成的字符串
  partner: "",

// 交易安全检验码，由数字和字母组成的32位字符串
  key: "",

// 签约支付宝账号或卖家收款支付宝帐户
  seller_email: "",

  ALIPAY_BARCODE_HOST: "https://openapi.alipay.com/gateway.do?charset=utf-8",

  host: 'https://openapi.alipay.com',
  path: '/gateway.do?charset=utf-8',

//↑↑↑↑↑↑↑↑↑↑请在这里配置您的基本信息↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑


// 调试用，创建TXT日志路径
  log_path: "~/alipay_log_.txt",

// 字符编码格式 目前支持 gbk 或 utf-8
  input_charset: "UTF-8",

// 签名方式 不需修改
  sign_type: "RSA"
};

/*
 *
 * method=alipay.trade.pay,
 app_id=2014072300007148,
 charset=utf-8,
 sign_type=RSA,
 timestamp=2014-07-24 03:07:50,
 biz_content={
 "out_trade_no": "201503022001",
 "scene": "bar_code",
 "auth_code": "283863507735868877",
 "total_amount": "88.88",
 "discountable_amount":"8.88",
 "undiscountable_amount ": "80",
 "subject": "条码支付",
 "goods_detail": [
 {
 "goods_id": "apple-01",
 "goods_name": "ipad",
 "goods_category": "7788230",
 "price": "88.88",
 "quantity": "1"
 }
 ],
 "operator_id": "op001",
 "store_id": "pudong001",
 "terminal_id": "t_001",
 "time_expire": "2015-01-24 03:07:50"
 }
 *http://app.alipay.com/market/document.htm?name=tiaomazhifu#page-10
 * */

var getTimestamp = function () {
  var d = new Date();
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  if (month < 10) {
    month = '0' + month;
  }
  var day = d.getDate();
  if (day < 10) {
    day = '0' + day;
  }
  var hour = d.getHours();
  if (hour < 10) {
    hour = '0' + hour;
  }
  var minutes = d.getMinutes();
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  var second = d.getSeconds();
  if (second < 10) {
    second = '0' + second;
  }
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minutes + ':' + second;
};

/**
 * 查询订单状态
 * @param {alipay} 支付宝扫码支付配置，包括app_id, 公钥，私钥等配置参数回调函数
 * @param {orderInfo} 订单参数
 * @param {callback} 毁掉函数
 */
var requestBarCodePay = function (alipay, orderInfo, callback) {
  //把请求参数打包成数组
  var timeStamp = getTimestamp();
  var sParaTemp = [];
  sParaTemp.push(["app_id", alipay.app_id]);
  sParaTemp.push(["method", 'alipay.trade.pay']);
  sParaTemp.push(["charset", 'utf-8']);
  sParaTemp.push(["sign_type", 'RSA']);
  sParaTemp.push(["timestamp", timeStamp]);

  var bizContentStr = '{';
  var arr = [];
  for (var key in orderInfo) {
    var keyValuePair = '"' + key + '":"' + orderInfo[key] + '"';
    arr.push(keyValuePair);
  }
  bizContentStr += arr.join(',') + '}';
  sParaTemp.push(["biz_content", bizContentStr]);

  var buildRequestPara = function (sParaTemp) {
    var sPara = [];
    //除去数组中的空值和签名参数
    for (var i1 = 0; i1 < sParaTemp.length; i1++) {
      var value = sParaTemp[i1];
      if (value[1] == null || value[1] == "" || value[0] == "sign") {
        continue;
      }
      sPara.push(value);
    }
    sPara.sort();
    //生成签名结果
    var prestr = "";
    //把数组所有元素，按照“参数=参数值”的模式用“&”字符拼接成字符串
    for (var i2 = 0; i2 < sPara.length; i2++) {
      var obj = sPara[i2];
      if (i2 == sPara.length - 1) {
        if (obj[0] == 'biz_content') {
          prestr = prestr + obj[0] + "=" + obj[1];
        } else {
          prestr = prestr + obj[0] + "=" + obj[1];
        }
      } else {
        if (obj[0] == 'biz_content') {
          prestr = prestr + obj[0] + "=" + obj[1] + '&';
        } else {
          prestr = prestr + obj[0] + "=" + obj[1] + "&";
        }
      }
    }

    //var privatePem = fs.readFileSync(__dirname + '/rsa_private_key.pem');
    //var key = privatePem.toString();
    //console.log(key);
    var signer = crypto.createSign('RSA-SHA1');
    signer.update(prestr);

    //myPrivateKey, 用户的私钥，字符串形式，也可以存在文件中，如上面的注释，这里我把私钥放到数据库里了
    var encrypted = signer.sign(alipay.myPrivateKey, 'base64');

    //签名结果与签名方式加入请求提交参数组中
    sPara.push(["sign", encrypted]);

    var data = {};
    for (var i3 = 0; i3 < sPara.length; i3++) {
      var obj = sPara[i3];
      var name = obj[0];
      value = obj[1];
      data[name] = value;
    }
    return data;
  };

  //构造函数，生成请求URL
  var sParams = buildRequestPara(sParaTemp);

  request({
    url: AlipayConfig.ALIPAY_BARCODE_HOST,
    method: "POST",
    headers: [
      {
        name: 'Content-type',
        value: 'application/x-www-form-urlencoded'
      }
    ],
    form: sParams
  }, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // 这里返回的参数，是需要使用支付宝的公钥进行验签的
    callback(null, body);
  });
};

/**
 * 查询订单状态
 * @param {alipay} 支付宝扫码支付配置，包括app_id, 公钥，私钥等配置参数回调函数
 * @param {orderInfo} 订单参数
 * @param {callback} 毁掉函数
 */
var queryBarCodePay = function (alipay, orderInfo, callback) {
  //把请求参数打包成数组
  var timeStamp = getTimestamp();
  var sParaTemp = [];
  sParaTemp.push(["app_id", alipay.app_id]);
  sParaTemp.push(["method", 'alipay.trade.query']);
  sParaTemp.push(["charset", 'utf-8']);
  sParaTemp.push(["sign_type", 'RSA']);
  sParaTemp.push(["timestamp", timeStamp]);

  var bizContentStr = '{';
  var arr = [];
  for (var key in orderInfo) {
    var keyValuePair = '"' + key + '":"' + orderInfo[key] + '"';
    arr.push(keyValuePair);
  }
  bizContentStr += arr.join(',') + '}';
  sParaTemp.push(["biz_content", bizContentStr]);

  var buildRequestPara = function (sParaTemp) {
    var sPara = [];
    //除去数组中的空值和签名参数
    for (var i1 = 0; i1 < sParaTemp.length; i1++) {
      var value = sParaTemp[i1];
      if (value[1] == null || value[1] == "" || value[0] == "sign") {
        continue;
      }
      sPara.push(value);
    }
    sPara.sort();
    //生成签名结果
    var prestr = "";
    //把数组所有元素，按照“参数=参数值”的模式用“&”字符拼接成字符串
    for (var i2 = 0; i2 < sPara.length; i2++) {
      var obj = sPara[i2];
      if (i2 == sPara.length - 1) {
        if (obj[0] == 'biz_content') {
          prestr = prestr + obj[0] + "=" + obj[1];
        } else {
          prestr = prestr + obj[0] + "=" + obj[1];
        }
      } else {
        if (obj[0] == 'biz_content') {
          prestr = prestr + obj[0] + "=" + obj[1] + '&';
        } else {
          prestr = prestr + obj[0] + "=" + obj[1] + "&";
        }
      }
    }

    //var privatePem = fs.readFileSync(__dirname + '/rsa_private_key.pem');
    //var key = privatePem.toString();
    //console.log(key);
    var signer = crypto.createSign('RSA-SHA1');
    signer.update(prestr);

    //myPrivateKey, 用户的私钥，字符串形式，也可以存在文件中，如上面的注释，这里我把私钥放到数据库里了
    var encrypted = signer.sign(alipay.myPrivateKey, 'base64');

    //签名结果与签名方式加入请求提交参数组中
    sPara.push(["sign", encrypted]);

    var data = {};
    for (var i3 = 0; i3 < sPara.length; i3++) {
      var obj = sPara[i3];
      var name = obj[0];
      value = obj[1];
      data[name] = value;
    }
    return data;
  };

  //构造函数，生成请求URL
  var sParams = buildRequestPara(sParaTemp);

  request({
    url: AlipayConfig.ALIPAY_BARCODE_HOST,
    method: "POST",
    headers: [
      {
        name: 'Content-type',
        value: 'application/x-www-form-urlencoded'
      }
    ],
    form: sParams
  }, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // 这里返回的参数，是需要使用支付宝的公钥进行验签的
    callback(null, body);
  });
};

exports.requestBarCodePay = requestBarCodePay;
exports.queryBarCodePay = queryBarCodePay;
