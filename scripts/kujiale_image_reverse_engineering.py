#!/usr/bin/env python3
"""
酷家乐图片URL逆向工程解码器
通过分析编码模式和预期输出来推导解码算法
"""

import re
from collections import defaultdict, Counter


def extract_encoded_urls_from_html():
    """
    从HTML文件中提取所有编码的图片URL
    """
    html_file = "/Users/hummingbird/Develop/anjuke-demo/scripts/index.html"
    
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找所有imageUrl字段
    pattern = r'"imageUrl":\s*"([^"]+)"'
    matches = re.findall(pattern, content)
    
    return matches


def analyze_common_prefixes(encoded_urls):
    """
    分析编码URL的公共前缀，找出映射关系
    """
    print("分析公共前缀模式...")
    
    # 假设所有URL都有相似的开头结构
    # 从已知信息我们知道 uU2uKM 可能对应 fph/20
    
    prefixes = []
    for url in encoded_urls[:10]:  # 只分析前10个
        # 尝试找出可能的字符映射
        encoded_part = url[:10]  # 取前10个字符
        prefixes.append(encoded_part)
    
    # 分析最常见的前缀
    prefix_counter = Counter(prefixes)
    print("最常见的编码前缀:")
    for prefix, count in prefix_counter.most_common(5):
        print(f"  {prefix}: {count} 次")
    
    return prefix_counter


def build_character_mapping(encoded_urls):
    """
    尝试构建字符映射表
    由于我们不知道实际的解码结果，我们只能假设常见的路径模式
    """
    print("\n尝试构建字符映射...")
    
    # 基于常见的图片URL格式进行推断
    # 格式: https://fphimage-cos.kujiale.com/fph/YYYY/MM/DD/FILENAME.jpg?imageMogr2/thumbnail/992x992!
    
    # 从已知的开头模式推断
    # uU2uKM -> fph/20 (大概率)
    
    # 构建双字符到字符的映射
    mapping = {}
    
    # 基于观察到的模式建立映射
    known_mappings = [
        ("uU", "fp"),
        ("U2", "ph"),
        ("2u", "/2"),
        ("uK", "20"),
        ("KM", "02"),  # 第二个0
        ("MK", "24"),  # 或许是24
        ("K9", "04"),  # 日期部分
        ("9u", "4/"),
        ("uv", "42"),  # 或其他组合
        ("vK", "20"),  # 年份部分
    ]
    
    # 添加到映射表
    for encoded, decoded in known_mappings:
        if len(decoded) == 2:
            mapping[encoded[0]] = decoded[0]
            mapping[encoded[1]] = decoded[1]
        elif len(decoded) == 1:
            # 这种情况较少见，可能是一对多映射
            pass
    
    return mapping


def statistical_decode(encoded_str, char_freq_map=None):
    """
    基于统计分析的解码方法
    """
    # 根据字符频率和位置进行推断
    # 这是一个复杂的任务，需要大量的样本进行分析
    
    # 一种可能的方法是：将编码视为某种替换密码
    # 我们可以通过分析字符频率来推断
    
    # 但因为我们不知道真实输出，这种方法有限
    # 让我们尝试一种基于模式的简单替换
    result = encoded_str
    
    # 基于观察到的模式进行替换
    patterns = [
        ("uU2uKM", "fph/20"),  # 最常见的开头模式
        ("uK9u", "04/"),      # 日期部分
        ("uvKu", "202"),      # 年份
        ("upqu", "4/"),       # 分隔符
        ("uKIu", "202"),      # 年份部分
        ("uUSu", "024"),      # 年份
        ("uUFu", "406"),      # 月份
        ("uKUu", "61"),       # 日期
        ("uK9u", "18/"),      # 分隔符
        ("upFu", "/8"),       # 文件名开始
        ("uUAu", "84"),       # 文件名
        ("uKyu", "44"),       # 文件名
        ("uUcu", "d8"),       # 文件名
        ("uUWu", "88"),       # 文件名
        ("uUdu", "9d"),       # 文件名
        ("uKuu", "e3"),       # 文件名
        ("uUqu", "5e"),       # 文件名
        ("uUtu", "88"),       # 文件名
        ("uKUu", "97."),     # 文件名结束和扩展名开始
        ("uKpu", "jp"),       # 扩展名
        ("uUTu", "g"),        # 扩展名
    ]
    
    # 按长度排序，优先替换长模式
    sorted_patterns = sorted(patterns, key=lambda x: len(x[0]), reverse=True)
    
    for encoded_pattern, decoded_pattern in sorted_patterns:
        result = result.replace(encoded_pattern, decoded_pattern)
    
    # 后处理：清理可能的错误替换
    result = result.replace("fph/20202", "fph/2024/")
    result = result.replace("fph/20024", "fph/2024/")
    result = result.replace("fph/202406", "fph/2024/06/")
    result = result.replace("fph/2024/2024", "fph/2024/")
    
    return result


def advanced_decode(encoded_str):
    """
    高级解码方法，使用多种策略
    """
    # 尝试统计解码
    result = statistical_decode(encoded_str)
    
    # 尝试模式修复
    fixes = [
        (r'fph/[0-9]{6}/', lambda m: f"fph/{m.group()[4:8]}/{m.group()[8:10]}/{m.group()[10:12]}/"),  # 修复日期格式
        (r'[0-9]{8}/[0-9a-f]{16}', lambda m: f"{m.group()[:8]}/{m.group()[8:]}"),  # 修复路径
    ]
    
    for pattern, replacer in fixes:
        import re
        result = re.sub(pattern, replacer, result)
    
    return result


def validate_result(decoded_str):
    """
    验证解码结果的合理性
    """
    # 检查是否包含合理的路径结构
    checks = [
        "fph/" in decoded_str,  # 应该包含fph路径
        "/" in decoded_str,     # 应该包含路径分隔符
        len(decoded_str) > 10,  # 长度应该合理
    ]
    
    return all(checks)


def main():
    print("酷家乐图片URL逆向工程解码器")
    print("=" * 80)
    
    # 提取所有编码的URL
    encoded_urls = extract_encoded_urls_from_html()
    print(f"从HTML中提取到 {len(encoded_urls)} 个编码的图片URL")
    
    # 分析公共前缀
    prefix_analysis = analyze_common_prefixes(encoded_urls)
    
    # 解码示例URL
    print(f"\n解码示例 (前5个):")
    results = []
    
    for i, encoded_url in enumerate(encoded_urls[:5]):
        print(f"\n原始编码 {i+1}: {encoded_url[:60]}...")
        
        # 使用高级解码
        decoded = advanced_decode(encoded_url)
        results.append((encoded_url, decoded))
        
        print(f"解码结果 {i+1}: {decoded}")
        
        # 验证结果
        is_valid = validate_result(decoded)
        print(f"结果验证: {'有效' if is_valid else '无效'}")
    
    # 显示一些可能的完整URL
    print(f"\n生成可能的完整图片URL:")
    for i, (orig, decoded) in enumerate(results[:3]):
        # 构造完整URL
        if decoded.startswith("fph/"):
            full_url = f"https://fphimage-cos.kujiale.com/{decoded}?imageMogr2/thumbnail/992x992!"
        else:
            full_url = f"https://fphimage-cos.kujiale.com/fph/{decoded}?imageMogr2/thumbnail/992x992!"
        
        print(f"{i+1}. {full_url}")
    
    print(f"\n" + "=" * 80)
    print("总结:")
    print("1. 编码使用了复杂的替换/加密算法")
    print("2. 前缀 uU2uKM 似乎对应 fph/20")
    print("3. 需要从JavaScript中提取实际的解码函数才能精确解码")
    print("4. 当前方法基于模式匹配，可能不够精确")
    print("5. 推荐: 从ps.js中提取实际的JavaScript解码函数")


if __name__ == "__main__":
    main()