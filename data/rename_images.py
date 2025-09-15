import os

def rename_files_in_directory(directory, start_number):
    try:
        files = [f for f in os.listdir(directory) if f.endswith(".jpg")]
        files.sort()
        
        current_number = start_number
        for file in files:
            old_path = os.path.join(directory, file)
            new_filename = f"{current_number}.jpg"
            new_path = os.path.join(directory, new_filename)
            
            os.rename(old_path, new_path)
            print(f"Đã đổi tên: {file} -> {new_filename}")
            current_number += 1
    except Exception as e:
        print(f"Đã xảy ra lỗi: {e}")

directory_path = "C:/Users/NONG QUOC KHANH/Videos/zoutput_images"
start_number = 998

rename_files_in_directory(directory_path, start_number)
