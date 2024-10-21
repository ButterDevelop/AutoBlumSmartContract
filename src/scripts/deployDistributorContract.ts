import { Address, Dictionary, toNano } from '@ton/core';
import { DistributorContract } from '../wrappers/DistributorContract';
import { NetworkProvider } from '@ton/blueprint';
import * as fs from 'fs';
import * as path from 'path';

// Функция для перемешивания массива (Fisher-Yates Shuffle)
function shuffle(array: string[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Меняем местами элементы
    }
    return array;
}

export async function run(provider: NetworkProvider) {
    // Путь к файлу с адресами
    const filePath = path.join(__dirname, 'recipients.txt');

    // Чтение файла и обработка строк (адресов)
    const data = fs.readFileSync(filePath, 'utf-8');  // Чтение файла с адресами
    let lines = data.trim().split('\n');  // Разделяем строки по символу новой строки

    // Перемешиваем строки
    lines = shuffle(lines);

    // Инициализация словаря для адресов
    const recipients = Dictionary.empty(Dictionary.Keys.BigInt(32), Dictionary.Values.Address());

    // Добавление адресов в словарь
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            recipients.set(BigInt(i), Address.parse(line));  // Используем BigInt для ключа и парсим строку как адрес
        }
    }

    const recipientsAmount = recipients.size;

    // Инициализация контракта с уникальным ID и словарем адресов
    const distributorContract = provider.open(await DistributorContract.fromInit(
        BigInt(Math.floor(Math.random() * 10000)),
        recipients,
        BigInt(recipientsAmount)
    ));

    // Отправка и развертывание контракта
    await distributorContract.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(distributorContract.address);

    console.log('ID', await distributorContract.getId());
}