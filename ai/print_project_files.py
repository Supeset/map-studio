import os
import re
import argparse
import fnmatch

def load_ignore_patterns(base_dir, extra_excludes=None):
    """
    加载忽略规则：合并 .gitignore 和手动排除项。
    """
    patterns = set(extra_excludes) if extra_excludes else set()
    
    # 尝试读取当前运行目录下的 .gitignore
    gitignore_path = os.path.join(base_dir, '.gitignore')
    if os.path.exists(gitignore_path):
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        patterns.add(line)
        except Exception as e:
            print(f"⚠️ Warning: 读取 .gitignore 失败: {e}")
            
    return list(patterns)

def is_ignored(path, base_dir, ignore_patterns):
    """
    检查路径是否被忽略。
    path: 文件的绝对路径
    base_dir: 相对路径的基准目录
    """
    name = os.path.basename(path)
    # 获取相对路径，并统一转为 Unix 风格 (/)
    rel_path = os.path.relpath(path, base_dir)
    if os.sep == '\\':
        rel_path = rel_path.replace('\\', '/')

    for pattern in ignore_patterns:
        # 1. 简单匹配文件名 (如 *.pyc, node_modules)
        if fnmatch.fnmatch(name, pattern):
            return True
        # 2. 匹配相对路径 (如 src/temp/*)
        if fnmatch.fnmatch(rel_path, pattern):
            return True
        # 3. 处理目录匹配 (如 dist/)
        if pattern.endswith('/') and rel_path.startswith(pattern):
            return True
            
    return False

def is_binary_file(filepath, blocksize=1024):
    """
    通过读取前1024个字节判断是否为二进制文件。
    """
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(blocksize)
            if b'\0' in chunk:  # 包含空字节通常是二进制文件
                return True
    except Exception:
        return True # 读取失败视为不需要处理的文件
    return False

def collect_files(inputs, file_regex, ignore_patterns, base_dir):
    """
    生成器：遍历输入列表，yield 符合条件的文件路径。
    """
    compiled_regex = re.compile(file_regex)

    for input_path in inputs:
        # 确保处理的是绝对路径
        abs_input_path = os.path.abspath(input_path)

        # 情况 A: 输入是文件
        if os.path.isfile(abs_input_path):
            if is_ignored(abs_input_path, base_dir, ignore_patterns):
                continue
            if compiled_regex.search(os.path.basename(abs_input_path)):
                 yield abs_input_path

        # 情况 B: 输入是目录
        elif os.path.isdir(abs_input_path):
            for root, dirs, files in os.walk(abs_input_path, topdown=True):
                # 过滤目录
                dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d), base_dir, ignore_patterns)]
                
                for filename in files:
                    file_path = os.path.join(root, filename)
                    
                    if is_ignored(file_path, base_dir, ignore_patterns):
                        continue
                    
                    if compiled_regex.search(filename):
                        yield file_path
        else:
            print(f"⚠️ Warning: 路径不存在，跳过: {input_path}")

def process_and_write(inputs, file_regex, output_file, exclude_list):
    """
    主处理逻辑
    """
    # 以当前工作目录为基准读取 .gitignore
    base_dir = os.getcwd()
    ignore_patterns = load_ignore_patterns(base_dir, exclude_list)
    
    # 准备输出流（如果是 stdout 则为 None）
    out_handle = None
    if output_file:
        try:
            out_handle = open(output_file, 'w', encoding='utf-8')
        except Exception as e:
            print(f"❌ Error: 无法创建输出文件: {e}")
            return

    def write_content(text):
        if out_handle:
            out_handle.write(text + "\n")
        else:
            print(text)

    count = 0
    print(f"🔎 正在扫描，基准目录: {base_dir}")
    print(f"   匹配规则: {file_regex}")
    
    # 使用生成器遍历文件
    for file_path in collect_files(inputs, file_regex, ignore_patterns, base_dir):
        rel_path = os.path.relpath(file_path, base_dir).replace('\\', '/')
        
        # 二进制检查
        if is_binary_file(file_path):
            print(f"   [跳过二进制] {rel_path}")
            continue

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            write_content(f"--- File: {rel_path} ---")
            write_content(content)
            write_content("\n" * 2)
            count += 1
            # 在控制台显示进度（如果输出到文件的话）
            if output_file:
                print(f"   [已添加] {rel_path}")

        except Exception as e:
            print(f"❌ Error 读取文件 {rel_path}: {e}")

    if out_handle:
        out_handle.close()
        print(f"\n✅ 完成! 共处理 {count} 个文件。内容已保存至: {output_file}")
    else:
        # 如果是打印到控制台，最后输出一个统计
        pass

def main():
    parser = argparse.ArgumentParser(
        description="CLI工具：合并多个文件或文件夹的内容。支持 .gitignore 排除。",
        formatter_class=argparse.RawTextHelpFormatter
    )
    # 核心变化：nargs='+' 允许接受一个或多个参数列表
    parser.add_argument(
        "paths",
        nargs='+',
        help="输入路径列表 (可以是文件或文件夹，用空格分隔)。"
    )
    parser.add_argument(
        "-r", "--regex",
        dest="file_regex",
        default=".*", # 默认匹配所有
        help="文件名匹配正则 (默认: '.*')。\n例如: '\\.(py|js)$' 只匹配 python 和 js 文件"
    )
    parser.add_argument(
        "-o", "--output",
        dest="output_file",
        help="输出文件路径。如果不填，则直接打印到控制台。"
    )
    parser.add_argument(
        "-e", "--exclude",
        dest="exclude_dirs",
        default=".git,node_modules,__pycache__,dist,build,.idea,.vscode",
        help="额外的排除项 (逗号分隔)。\n默认已排除: .git, node_modules, dist 等"
    )

    args = parser.parse_args()
    
    exclude_list = [item.strip() for item in args.exclude_dirs.split(',') if item.strip()]

    process_and_write(args.paths, args.file_regex, args.output_file, exclude_list)

if __name__ == "__main__":
    main()