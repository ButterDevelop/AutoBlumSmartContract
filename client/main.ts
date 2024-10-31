import fs from 'fs';
import path from 'path';
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToPrivateKey } from "ton-crypto";
import { SendMode, TonClient, WalletContractV4, WalletContractV5R1, internal, Address, fromNano } from "@ton/ton";
import { RestClient, WithdrawRequest } from 'okx-api';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Путь к файлам с данными
const _walletFilePath        = path.join(__dirname, 'botWallets.txt');
const _dbFilePath            = path.join(__dirname, 'activatedWallets.json');
const _randomWalletsFilePath = path.join(__dirname, 'randomWallets.txt');

async function sendTelegramMessage(text: string) {
    const apiUrl   = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id:    process.env.TELEGRAM_CHAT_ID,
            text:       text,
            parse_mode: 'HTML',
        }),
    });

    if (response.ok) {
        log('Telegram message sent successfully.');
    } else {
        errorLog(`Failed to send Telegram message: ${response.statusText}`);
    }
}

function formatDate(date: Date): string {
    const day     = String(date.getDate()).padStart(2, '0');
    const month   = String(date.getMonth() + 1).padStart(2, '0');
    const year    = date.getFullYear();
    const hours   = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

function log(str: string) {
    console.log(`[${formatDate(new Date())}] ${str}`);
}

function errorLog(str: string) {
    console.error(`[${formatDate(new Date())}] ${str}`);
}

// Асинхронная функция для чтения данных из файла
async function readStringsFromFile(filename: string): Promise<string[]> {
    const data = await fs.promises.readFile(filename, 'utf-8');
    return data.split('\n').filter(Boolean);
}

// Асинхронная функция для записи JSON данных в файл
async function writeToJSONFile(data: any) {
    await fs.promises.writeFile(_dbFilePath, JSON.stringify(data, null, 2));
}

// Чтение базы данных
async function readDb(): Promise<any> {
    if (fs.existsSync(_dbFilePath)) {
        const data = await fs.promises.readFile(_dbFilePath, 'utf-8');
        return JSON.parse(data);
    }
    return { withdrawn: [], activated: [] };
}

// Случайный выбор кошелька из списка
function getRandomElement(elements: string[]): string {
    const randomIndex = Math.floor(Math.random() * elements.length);
    return elements[randomIndex];
}

// Получение случайного значения TON
function getRandomTonValue(): number {
    const min = 0.02;
    const max = 0.1;
    return (Math.random() * (max - min) + min);
}

// Случайный интервал времени
function getRandomDelay(): number {
    const min = 0.1 * 60 * 60 * 1000; // минимум 0.5 часа
    const max = 2.0 * 60 * 60 * 1000; // максимум 2 часа
    return Math.floor(Math.random() * (max - min) + min);
}

async function getTransferParameters(secretKey: Buffer, seqno: number, randomWalletAddress: string, balanceStr: string) {
    const toTransferParameters = {
      secretKey: secretKey,
      seqno,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
          internal({
              to:    Address.parse(randomWalletAddress.substring(0, randomWalletAddress.length - 1)),
              value: (Math.min(getRandomTonValue(), Number(balanceStr)) / 2).toFixed(2), // случайная сумма
          }),
      ],
    };
    return toTransferParameters;
}

// Функция для вывода с биржи на кошелёк
async function withdrawToWallet(amount: string, toAddr: string): Promise<boolean> {
    const API_KEY    = process.env.API_KEY;
    const API_SECRET = process.env.API_SECRET;
    const API_PASS   = process.env.API_PASS;

    if (!API_KEY || !API_SECRET || !API_PASS) {
        errorLog(`Missing API credentials. Use environmental variables or hard code in the script.`);
        return false;
    }

    const client = new RestClient({
        apiKey:    API_KEY,
        apiSecret: API_SECRET,
        apiPass:   API_PASS
    });

    let minFee: string = "0.01";

    //await client.getCurrencies('TON').then((result) => {
    //    minFee = result[0].minFee;
    //
    //    log(`Get currencies. Min fee: ${result[0].minFee}, max fee: ${result[0].maxFee}. Chain: ${result[0].chain}`);
    //}).catch((error) => {
    //    errorLog(`Failed to get currencies: ${error}`);
    //    return false;
    //});

    const paramsForRequest: WithdrawRequest = {
        amt:    amount,    // Сколько вывести
        fee:    minFee,    // Фиксированная комиссия
        dest:   '4',       // Тип вывода (on-chain withdrawal)
        ccy:    'TON',     // Валюта
        chain:  'TON-TON', // Цепочка
        toAddr: toAddr     // Адрес для вывода
    };

    let returnResult: boolean = false;

    await client.submitWithdraw(paramsForRequest).then((result) => {
        log(`(WITHDRAWAL) Withdrawal successful: ${result[0].amt}`);
        returnResult = true;
    }).catch((error) => {
        errorLog(`(WITHDRAWAL) Failed to withdraw funds: ${JSON.stringify(error)}`);
        returnResult = false;
    });

    return returnResult;
}

// Функция активации кошелька
async function activateWallet(client: TonClient, walletVersion: string, mnemonic: string[], randomWalletAddress: string): Promise<boolean> {
    // Генерация ключей на основе мнемоники
    const key = await mnemonicToPrivateKey(mnemonic);
  
    await sleep(120 * 1000);

    if (walletVersion === 'W5') {
        // Для версии W5
        const wallet         = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 });
        const walletContract = client.open(wallet);
        const seqno          = await walletContract.getSeqno();

        // Смотрим, прошла ли транзакция, с помощью баланса
        const balanceBefore = await walletContract.getBalance();
        await walletContract.sendTransfer(await getTransferParameters(key.secretKey, seqno, randomWalletAddress, fromNano(balanceBefore)));
        await sleep(120 * 1000);
        const balanceAfter = await walletContract.getBalance();

        // Транзакция прошла
        return balanceAfter < balanceBefore;
    } else if (walletVersion === 'W4') {
        // Для версии W4
        const wallet         = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
        const walletContract = client.open(wallet);
        const seqno          = await walletContract.getSeqno();

        // Смотрим, прошла ли транзакция, с помощью баланса
        const balanceBefore = await walletContract.getBalance();
        await walletContract.sendTransfer(await getTransferParameters(key.secretKey, seqno, randomWalletAddress, fromNano(balanceBefore)));
        await sleep(120 * 1000);
        const balanceAfter = await walletContract.getBalance();

        // Транзакция прошла
        return balanceAfter < balanceBefore;
    } else {
        throw new Error(`Unsupported wallet version: ${walletVersion}`);
    }
}

async function processWalletsInTwoThreads() {
    const endpoint      = await getHttpEndpoint({ network: "mainnet" });
    const client        = new TonClient({ endpoint });
    const wallets       = await readStringsFromFile(_walletFilePath);
    const db            = await readDb();
    const randomWallets = await readStringsFromFile(_randomWalletsFilePath);

    const activatedQueue: string[] = []; // Список кошельков для активации

    // Первый поток - вывод средств
    async function processWithdrawals() {
        log(`(WITHDRAWAL) Started withdrawal thread.`);

        let currentIndex = wallets.length - 1;
        while (currentIndex >= 0) {
            log(`(WITHDRAWAL) Current wallet index: ${currentIndex}`);

            const currentWallet = wallets[currentIndex--];
            const [walletNumber, walletVersion, address] = currentWallet.split(' ');
  
            if (!db.withdrawn.includes(address)) {
                const amount = getRandomTonValue();
  
                log(`(WITHDRAWAL) Withdrawing ${amount} TON to ${address}, id=${walletNumber}, ${walletVersion} wallet.`);
                
                // Вывод средств через биржу
                const withdrawalResult = await withdrawToWallet(amount.toFixed(2), address);
                log(`(WITHDRAWAL) Withdrawal to ${address} (id=${walletNumber}, ${walletVersion} wallet) result: ${withdrawalResult}`);
                if (withdrawalResult) {
                    // После успешного вывода средств добавляем кошелек в очередь для активации
                    activatedQueue.push(currentWallet);

                    // Обновление списка выведенных кошельков
                    db.withdrawn.push(address);
                    await writeToJSONFile(db);
                }

                sendTelegramMessage(`<b>Withdrawal</b> to <code>${address}</code> (id=<b>${walletNumber}</b>, <b>${walletVersion}</b> wallet) result: <b>${withdrawalResult}</b>`);

                // Спим на случайный промежуток времени
                const delay = getRandomDelay();
                log(`(WITHDRAWAL) Waiting ${delay / (60 * 60 * 1000)} hours before next withdrawal...`);
                await sleep(delay);
            } else {
                log(`(WITHDRAWAL) Already withdrawn on ${address}, id=${walletNumber}, ${walletVersion} wallet.`);
            }
        }
    }

    // Второй поток - активация кошельков
    async function processActivations() {
        log(`(ACTIVATION) Started wallet activation thread.`);

        db.withdrawn.forEach((withdrawnWallet: string) => {
            if (!db.activated.includes(withdrawnWallet)) {
                const matchingWallet = wallets.find(wallet => wallet.includes(withdrawnWallet));
                if (matchingWallet) {
                    activatedQueue.push(matchingWallet);
                }
            }
        });        

        while (true) {
            if (activatedQueue.length > 0) {
                const currentWallet = activatedQueue.shift();
                if (currentWallet == null) {
                    continue;
                }
                const [walletNumber, walletVersion, address, ...mnemonic] = currentWallet.split(' ');
  
                if (!db.activated.includes(address)) {
                    log(`(ACTIVATION) Activating wallet: ${address} with id=${walletNumber}, ${walletVersion} wallet.`);
  
                    const randomWalletAddress = getRandomElement(randomWallets);

                    // Активировать кошелёк
                    const activationResult = await activateWallet(client, walletVersion, mnemonic, randomWalletAddress);
                    if (activationResult) {
                        // Обновление списка активированных кошельков
                        db.activated.push(address);
                        await writeToJSONFile(db);

                        log(`(ACTIVATION) Wallet ${address} with id=${walletNumber} (${walletVersion} wallet) has been activated`);
                    } else {
                        activatedQueue.push(currentWallet);
                        errorLog(`(ACTIVATION) Wallet ${address} with id=${walletNumber} (${walletVersion} wallet) was NOT activated. Added again to the queue.`);
                    }

                    sendTelegramMessage(`<b>Activation</b> of <code>${address}</code> (id=<b>${walletNumber}</b>, <b>${walletVersion}</b> wallet) result: <b>${activationResult}</b>`);
                } else {
                    log(`(ACTIVATION) Already activated on ${address}, id=${walletNumber}, ${walletVersion} wallet.`);
                }
            } else {
                log(`(ACTIVATION) No wallets to activate yet.`);
            }
  
            // Спим на случайный промежуток времени
            const delay = getRandomDelay();
            log(`(ACTIVATION) Waiting ${delay / (60 * 60 * 1000)} hours before next wallet activation...`);
            await sleep(delay);
        }
    }

    // Запуск потоков
    processWithdrawals().catch(errorLog);
    processActivations().catch(errorLog);
}

// Вспомогательная функция ожидания
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция проверки кошельков
async function checkWalletData(client: TonClient, walletString: string): Promise<boolean> {
    // Парсинг строки кошелька
    const [walletNumber, walletVersion, address, ...mnemonic] = walletString.split(' ');
    // Генерация ключей на основе мнемоники
    const key = await mnemonicToPrivateKey(mnemonic);

    if (walletVersion === 'W5') {
        // Для версии W5
        const wallet         = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 });
        const walletContract = client.open(wallet);

        const balance          = await walletContract.getBalance();
        const walletApiAddress = walletContract.address.toString({bounceable: false});

        // Выводим адреса
        if (walletApiAddress != address) {
            log(`${walletNumber}, ${walletApiAddress} <=> ${address}, balance: ${balance}`);
        }

        // Проверяем, совпадают ли адреса
        return walletApiAddress == address && balance > 0n;
    } else if (walletVersion === 'W4') {
        // Для версии W4
        const wallet         = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
        const walletContract = client.open(wallet);

        const balance          = await walletContract.getBalance();
        const walletApiAddress = walletContract.address.toString({bounceable: false});

        // Выводим адреса
        if (walletApiAddress != address) {
            log(`${walletNumber}, ${walletApiAddress} <=> ${address}, balance: ${balance}`);
        }

        // Проверяем, совпадают ли адреса
        return walletApiAddress == address && balance > 0n;
    } else {
        return false;
    }
}

// Поток проверки кошельков перед основным действом
async function processWalletsCheck() {
    const endpoint = await getHttpEndpoint({ network: "mainnet" });
    const client   = new TonClient({ endpoint });
    const wallets  = await readStringsFromFile(_walletFilePath);
    let good = 0;
    for (let i = 0; i < wallets.length; i++) {
        log(`${i + 1}/${wallets.length} checked wallet`);

        const result = await checkWalletData(client, wallets[i]);
        if (result) {
            good += 1;
        }

        console.clear();
        await sleep(300);
    }
    log(`Good wallets: ${good}/${wallets.length}`);
}


// Запуск программы
processWalletsInTwoThreads().catch(errorLog);

// Запуск проверки аккаунтов
processWalletsCheck().catch(errorLog);