python3 scripts/kujiale_download.py --url "https://www.kujiale.cn/huxing/result/291-9e3f-8363-6e90-20-5c1a-4e91-0-0?area_level=3&precise=0" --out "./downloads/kujiale" --media-only --debug-log --manual-login

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

