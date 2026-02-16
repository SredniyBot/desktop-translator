#!/bin/bash

# Создаем целевую директорию
OUTPUT_DIR="./target"
OUTPUT_FILE="$OUTPUT_DIR/all_code.txt"
mkdir -p "$OUTPUT_DIR"

# Очищаем файл перед записью
> "$OUTPUT_FILE"

echo "Начинаю сборку файлов из ./src..."

# Рекурсивный поиск всех файлов в ./src
# -type f ищет только файлы
find ./src -type f | while read -r file; do

    # Пропускаем бинарные файлы (опционально, но полезно для LLM)
    if grep -qI '.' "$file"; then
        relative_path="${file#./}"

        # Определяем расширение для подсветки синтаксиса (java, js, css, html и т.д.)
        extension="${file##*.}"

        echo "Добавляю: $relative_path"

        # Формируем структуру: путь + код в блоке
        echo "\`\`\`$extension" >> "$OUTPUT_FILE"
        echo "// File: $relative_path" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "\`\`\`" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE" # Пустая строка между файлами
    else
        echo "Пропуск бинарного файла: $file"
    fi
done

echo "--------------------------------------"
echo "Готово! Весь код собран в: $OUTPUT_FILE"