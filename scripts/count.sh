#!/bin/bash

# Base directory path
BASE_DIR="./../downloads/kujiale/json"

# Supported cities and developers (Chinese names)
CITIES=("上海市" "北京市" "深圳市" "广州市")
DEVELOPERS=("万科" "中海" "华润")
ROOM_TYPES=("1居" "2居" "3居" "4居" "5居")

# Variable to store the grand total
GRAND_TOTAL=0

# Function to extract the numeric part from filename and add 100
extract_count() {
    local filename="$1"
    local num_part
    num_part=$(echo "$filename" | sed -E 's/.*_([0-9]+)\.json/\1/')
    if [[ -n "$num_part" ]]; then
        echo $((num_part + 100))
    else
        echo 100 # Default to 100 if no numeric part is found
    fi
}

# Function to find the largest numeric value in filenames
find_largest_numeric_value() {
    local dir="$1"
    local max_num=-1 # Initialize to -1 to handle cases where no files exist

    for file in "$dir"/*.json; do
        if [[ -f "$file" ]]; then
            local num_part
            num_part=$(basename "$file" | sed -E 's/.*_([0-9]+)\.json/\1/')
            if [[ -n "$num_part" && "$num_part" -gt "$max_num" ]]; then
                max_num="$num_part"
            fi
        fi
    done

    # If no valid numeric value is found, default to 0
    if [[ "$max_num" -eq -1 ]]; then
        max_num=0
    fi

    echo "$max_num"
}

# Traverse directories and process files
for city in "${CITIES[@]}"; do
    city_path="$BASE_DIR/$city"
    if [[ ! -d "$city_path" ]]; then
        echo "Directory $city_path does not exist."
        continue
    fi

    for developer in "${DEVELOPERS[@]}"; do
        developer_path="$city_path/$developer"
        if [[ ! -d "$developer_path" ]]; then
            echo "Directory $developer_path does not exist."
            continue
        fi

        for room_type in "${ROOM_TYPES[@]}"; do
            room_path="$developer_path/$room_type"
            if [[ ! -d "$room_path" ]]; then
                echo "Directory $room_path does not exist."
                continue
            fi

            # Find the largest numeric value in this room type folder
            largest_num=$(find_largest_numeric_value "$room_path")
            count=$((largest_num + 100))
            echo "Processing: $city/$developer/$room_type -> Largest Num: $largest_num -> Count: $count"
            GRAND_TOTAL=$((GRAND_TOTAL + count))
        done
    done
done

# Print grand total
echo -e "\n合计总数: $GRAND_TOTAL"