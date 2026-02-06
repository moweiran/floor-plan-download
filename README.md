# floor-plan-download
node /Users/hummingbird/Develop/anjuke-demo/scripts/decode_image_url.js \
  "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupqupTuUSuUSuUSupcuUSuUSuUqupcup2upmuUFuvUuvUupmuvUupFuUcuKKuUm"

node /Users/hummingbird/Develop/anjuke-demo/scripts/decode_image_url.js \
  "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupqupcup2uUTuUFupAuUquvuuUduvuuUtuvUuUtupAupcuUtuvuupFuUcuKKuUm"

```
node /Users/hummingbird/Develop/anjuke-demo/scripts/decode_image_url.js \
  "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupquvUuvvupTuUSupcuvpupmuUSupAuvUuUFuvvuUSupWuUqupcupFuUcuKKuUm"
```

  node /Users/hummingbird/Develop/anjuke-demo/scripts/decode_image_url.js \
  "uU2uKMuKMuKKuK9uvKupqupquUTuKKuU2uUWuKpuUduUmuUquptuUtuKUuK9upFuUAuKyuUcuUWuUduKuuUqupFuUtuKUuKpupquUTuKKuU2upqup2upTup2upcupTuvvupTupWupqupTuUSuUSuUSupcuUSuUSuUqupcup2upmuUFuvUuvUupmuvUupFuUcuKKuUm"


https://www.kujiale.cn/huxing/result/36-534e-6da6-0-0?num=100&start=4999
https://www.kujiale.cn/huxing/result/36-534e-0-0?num=100&start=4999
https://www.kujiale.cn/huxing/result/36-56ed-0-0?num=100&start=4999

先帮我由decode_image_url.js的js代码分析后，转为python写法，同时测试


  非常好！上面的解码问题解决了
  现在我要加一个新的版本需求
  -decode_image_url.py备份一下
  -重新命名一个下载户型图的python脚本
  -基于decode_image_url.py备份一下
  -基于行现在的代码，拿到dom结构
  -分析dom结构，找到window.__PAGE_STATE__
  -获取其中的searchResult
  -"total": 8358,
                    "num": 100,
                    "start": 4900,
                    "list": []
  -其中total表示所有的数据条数，那么你可以得到分页数
  -num表示当前页
  -start表示偏移量
  -list为最终的数组数据，格式如下：
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
        根据decode_image_url.py文件
        解析出imageUrl,withoutDimensionLine,wallCenterLine,insideTheWall
        然后生成新的json文件，按城市，开发商，分页来整理json文件
        其他的分页和跳转下一页保持原来的方式，不用再监听response中的image url了


```
python3 /Users/hummingbird/Develop/anjuke-demo/scripts/kujiale_page_state_export.py \
  --out "./downloads/kujiale/json" \
  --num 100
```

-可以再加一个机制，需要等整个页面都渲染完后，再下一页吗？加一个这样的等待机制
-电脑休眠后，运行中的拉取代码会中断吗？拉取数据期间，不要让电脑休眠，加上这样的逻辑机制

保利
万科
中海
华润
绿地
越秀
招商
绿城


3500 + 400 + 4900 + 
4900 + 1500 + 4900 + 
3400 + 1200 + 900 + 
2300 + 900 + 4900
The total is 36,800.



前提： 
- 你是一名开发人员 
- 用一张房产户型图生成了一张2D效果的图片 
- 图片中有很多家具 
需求： 
- 我需要对图片中的每个家具单独标注，可以在web页面上选中 
- 选中后有特殊的UI效果，高亮或加边框 
- 选中后显示下拉列表弹窗 
- 弹窗内容显示多条同类型的家具信息，提供选择 
- 选中下拉列表弹窗的某条数据后，可以替换这个家具 
- 具体的技术方案是什么 
- 提供简单的案例demo 
- 如果有现成的参考，可以给出