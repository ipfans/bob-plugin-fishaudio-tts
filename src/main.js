var config = require('./config.js');
var CryptoJS = require("crypto-js");

function supportLanguages() {
  return config.supportedLanguages.map(([standardLang]) => standardLang);
}

const langMap = new Map(config.supportedLanguages);

/**
 * 文本转语音主函数
 * @param {object} query - 查询参数
 * @param {function} completion - 完成回调
 */
function tts(query, completion) {
  const targetLanguage = langMap.get(query.lang);
  if (!targetLanguage) {
    completion({
      error: {
        type: 'unsupportLanguage',
        message: '不支持该语种',
        addition: {}
      }
    });
    return;
  }

  const speaker = $option[targetLanguage + '-speaker'];
  const text = query.text;
  const secretKey = $option['apiKey'];
  const cacheDataNum = $option['cacheDataNum'];
  const model = $option['model'] || 'speech-1.6';
  const apiEndpoint = $option['apiEndpoint'] || 'https://api.fish.audio';
  const audioKey = CryptoJS.MD5(speaker + text + model).toString();
  const audioPath = '$sandbox/' + audioKey;

  let audioData = '';

  // 检查缓存
  if ($file.exists(audioPath)) {
    audioData = $file.read(audioPath).toUTF8();
    completion({
      result: {
        type: "base64",
        value: audioData,
        raw: {}
      }
    });
    return;
  }

  // 调用 API 获取音频
  $http.request({
    method: "POST",
    url: apiEndpoint + "/v1/tts",
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`
    },
    body: {
      text,
      reference_id: speaker,
      mp3_bitrate: 128,
      model: model
    }
  }).then(function (resp) {
    audioData = $data.fromData(resp.data).toBase64();
    handleCache(audioKey, audioData, audioPath, cacheDataNum);
    completion({
      result: {
        type: "base64",
        value: audioData,
        raw: {}
      }
    });
  }).catch(function (err) {
    $log.error(err);
    completion({
      error: {
        type: err._type || 'unknown',
        message: err._message || '未知错误',
        addition: {}
      }
    });
  });
}

/**
 * 处理音频缓存
 * @param {string} audioKey - 音频唯一标识
 * @param {string} audioData - 音频数据
 * @param {string} audioPath - 音频存储路径
 * @param {number} cacheDataNum - 缓存数量限制
 */
function handleCache(audioKey, audioData, audioPath, cacheDataNum) {
  // 保存音频文件
  const audioDataSaveSucc = $file.write({
    data: $data.fromUTF8(audioData),
    path: audioPath
  });

  if (!audioDataSaveSucc) return;

  const cachesPath = '$sandbox/caches.list';
  let cachesList = audioKey;

  // 处理缓存列表
  if ($file.exists(cachesPath)) {
    const data = $file.read(cachesPath);
    const cacheData = data.toUTF8().split("\n");

    // 超出限制时删除最早的缓存
    if (cacheData.length >= cacheDataNum) {
      const delAudioKey = cacheData.shift();
      $file.delete('$sandbox/' + delAudioKey);
    }

    cacheData.push(audioKey);
    cachesList = cacheData.join("\n");
  }

  // 更新缓存列表
  $file.write({
    data: $data.fromUTF8(cachesList),
    path: cachesPath
  });
}

exports.supportLanguages = supportLanguages;
exports.tts = tts;