python3 scripts/kujiale_download.py --url "https://www.kujiale.cn/huxing/result/291-9e3f-8363-6e90-20-5c1a-4e91-0-0?area_level=3&precise=0" --out "./downloads/kujiale" --media-only --debug-log --manual-login

``
python3 /Users/hummingbird/Develop/anjuke-demo/scripts/kujiale_download.py \
  --out "./downloads/kujiale" \
  --num 50 \
  --manual-login
```


1. 库家乐提供了一个全国的区域json数据
2. 根据不同的区域ID，打开对应的页面
3. 输入地产商的名字
4. 第一页可以获取到对应有多少个户型图，字段在<span class="resultTotal">258</span>
5. 

https://www.kujiale.cn/huxing/result/291-534e-6da6-0-0?area_level=3&word_from=2&precise=0

https://www.kujiale.cn/huxing/result/291-7eff-57ce-0-0?num=100&start=4900

绿城：7eff-57ce
华润：534e-6da6
中海：4e2d-6d77


https://www.kujiale.cn/huxing/result/291-534e-6da6-0-0?num=100&start=4900
291-区域代码ID
534e-华
6da6-润
num=100：每页100条数据
start=4900:分页偏移量
其中534e-6da6用的编码方式如下：
def encode_dev_name(name: str) -> str:
    """开发商名称 → UTF-16BE十六进制编码"""
    if len(name) != 2:
        raise ValueError("仅支持2个汉字")
    utf16_bytes = name.encode('utf-16be')
    return utf16_bytes.hex()[:4] + '-' + utf16_bytes.hex()[4:]

def decode_dev_code(code: str) -> str:
    """UTF-16BE十六进制编码 → 开发商名称"""
    hex_str = code.replace('-', '')
    return bytes.fromhex(hex_str).decode('utf-16be')

# 使用示例
print(encode_dev_name('华润'))  # 输出: 534e-6da6
print(decode_dev_code('4e07-79d1'))  # 输出: 华润
根据上面的分析
帮我重新调整下载图片的方式
-同样也是用on_request接受图片数据下载
-根据分页规则，每页下载50张图片，自动化实现分页下载
-城市编码如下
--北京市：36
--上海市：39
--广州市：289
--深圳市：291
-下载的开发商名字如下，编码方式如上面的代码
--华润
--中海
--万科
-下载的图片按不同城市，不同开发商文件夹区分


我需要继续优化
发现的问题是
1.每页有50条数据，但其实还没下载50条，就下一页了，这样是有问题的
2.下载的图片分辨率不是496x496的，而应该是imageMogr2/thumbnail/992x992!


解码数据
```
{
                        "nationId": 0,
                        "nationName": "中国",
                        "stateId": 19,
                        "stateName": "广东省",
                        "cityId": 291,
                        "cityName": "深圳市",
                        "obsCommunityId": "3FO4KFKHILQR",
                        "commName": "信城缙华府",
                        "obsPlanId": "3FO3L9I77WP0",
                        "obsDesignId": "3FO3L9I77WP0",
                        "isBim": true,
                        "name": "信城缙华府4室2厅0厨4卫",
                        "imageUrl": "uU2uKMuKMuKKuK9uvKupqupquKIuU2uKMuUSuUFuKUuK9uK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuUWuKpuUmuKvuUquKzupquKKuKNuKUuUFupquKuupqupWuvduvcupWuvmuvUuvFuvpuvpuUNuvAupTupquvvuUTupAupcuvpuUtuUFuUduptuvpuvpupWuUFuptupcuUquvvuvpuptuUduvpuvUuvUuptuUFupWuUFuUFupmupAuvuupcuUFuUtuUFupmupFuUcuKKuUm",
                        "buildArea": "76.73m²",
                        "useArea": "65.34m²",
                        "specsInfo": "4室2厅0厨4卫",
                        "publicType": "推荐",
                        "withoutDimensionLine": "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupqupTuUSuUSuUSupcuUSuUSuUqupcup2upmuUFuvUuvUupmuvUupFuUcuKKuUm",
                        "wallCenterLine": "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupqupcup2uUTuUFupAuUquvuuUduvuuUtuvUuUtupAupcuUtuvuupFuUcuKKuUm",
                        "insideTheWall": "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupquvUuvvupTuUSupcuvpupmuUSupAuvUuUFuvvuUSupWuUqupcupFuUcuKKuUm",
                        "updateTime": 1743590620000
                    }
```

需要解码
前端的js代码如下
帮我解析出imageUrl字段的内容
参考：
"imageUrl": "uU2uKMuKMuKKuK9uvKupqupquKIuU2uKMuUSuUFuKUuK9uK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuUWuKpuUmuKvuUquKzupquKKuKNuKUuUFupquKuupqupWuvduvcupWuvmuvUuvFuvpuvpuUNuvAupTupquvvuUTupAupcuvpuUtuUFuUduptuvpuvpupWuUFuptupcuUquvvuvpuptuUduvpuvUuvUuptuUFupWuUFuUFupmupAuvuupcuUFuUtuUFupmupFuUcuKKuUm",
结果为：https://fphimage-cos.kujiale.com/fph/20240618/844d889de35e8897.jpg?imageMogr2/thumbnail/992x992!这样的格式

python3 /Users/hummingbird/Develop/anjuke-demo/scripts/decode_image_url.py \
  --wasm-file /Users/hummingbird/Develop/anjuke-demo/scripts/optimized.wasm \
  --list-exports
  "uU2uKMuKMuKKuK9uvKupqupquKIuU2uKMuUSuUFuKUuK9uK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuUWuKpuUmuKvuUquKzupquKKuKNuKUuUFupquKuupqupWuvduvcupWuvmuvUuvFuvpuvpuUNuvAupTupquvvuUTupAupcuvpuUtuUFuUduptuvpuvpupWuUFuptupcuUquvvuvpuptuUduvpuvUuvUuptuUFupWuUFuUFupmupAuvuupcuUFuUtuUFupmupFuUcuKKuUm"


  {
                                "content": "一居",
                                "value": "1",
                                "display": true,
                                "data": 614
                            }, {
                                "content": "二居",
                                "value": "2",
                                "display": true,
                                "data": 2563
                            }, {
                                "content": "三居",
                                "value": "3",
                                "display": true,
                                "data": 3489
                            }, {
                                "content": "四居",
                                "value": "4",
                                "display": true,
                                "data": 1286
                            }, {
                                "content": "五居及以上",
                                "value": "5",
                                "display": true,
                                "data": 282
                            }


继续分析，根据附件的代码，我需要加一个ROOMS，按居室来搜索
- 保持原来的代码基本不变
- 加入ROOMS条件，[1,2,3,4,5]，分别表示一居，二居，三居，四居，五居以上
- 分析查询条件https://www.kujiale.cn/huxing/result/{city_code}-{dev_code}-0-0,其中
https://www.kujiale.cn/huxing/result/{city_code}-{dev_code}-1-0表示一居
https://www.kujiale.cn/huxing/result/{city_code}-{dev_code}-2-0表示二居
- 下载的文件夹加一个按居室来
- json数据也要加一个居室的value值
- 保持其他的业务逻辑不变
- 保持其他的业务逻辑不变
- 保持其他的业务逻辑不变

python3 /Users/hummingbird/Develop/anjuke-demo/scripts/kujiale_page_state_export.py \
  --out "./downloads/kujiale/json" \
  --num 200


我已经在本地docker中部署了一个postgresql数据库
访问的地址为：localhost
端口号：5423

需要将json数据导入到数据库中
需求
- 数据格式可以通过读取json文件提取，然后创建数据库

python3 /Users/hummingbird/Develop/anjuke-demo/scripts/import_kujiale_json.py \
  --host 127.0.0.1 --port 5432 --user postgres --password fams --db chaodapei

python3 /Users/hummingbird/Develop/anjuke-demo/scripts/import_kujiale_json.py \
  --host 127.0.0.1 --port 5432 --user postgres --password fams --db chaodapei