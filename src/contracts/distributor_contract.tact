import "@stdlib/deploy";

contract DistributorContract with Deployable {
    const MinTonForStorage:        Int = ton("0.02");
    const ApproxGasForTransaction: Int = ton("0.006");

    id:               Int as uint32;     // Id для контракта, чтобы сделать его уникальнее
    owner:            Address;           // Адрес владельца контракта
    recipients:       map<Int, Address>; // Список кошельков для раздачи
    recipientsAmount: Int as uint32;     // Количество элементов в "массиве"
    currentIndex:     Int as uint32;     // Текущий индекс
    sumToGive:        Int as uint32;     // Уже отправленная сумма

    init(id: Int, recipientAddresses: map<Int, Address>, recipientsAmount: Int) {
        self.id               = id;
        self.owner            = sender();
        self.recipients       = recipientAddresses;
        self.recipientsAmount = recipientsAmount;
        self.currentIndex     = 0;
        self.sumToGive        = 0;
    }

    // От лишних денег не откажемся, конечно. Проводим перерасчёт средств.
    receive() {
        self.sumToGive = self.recalculateSumToGive(context().value);
    }

    // Выполняем основную функцию
    receive("g") {
        require(sender() == self.owner, "Only owner is allowed to do this");
        let result: Bool = self.distribute();
        if (!result) {
            self.reply("0".asComment());
        }
    }

    // Это снимет весь баланс контракта и оставит 0
    receive("wa") {
        require(sender() == self.owner, "Only owner is allowed to withdraw");
        send(SendParameters {
            to:     sender(),
            bounce: true,
            value:  0,
            mode:   SendRemainingBalance + SendIgnoreErrors
        });
    }

    // При этом будет снят весь баланс, но останется 0.01 на оплату аренды хранилища
    receive("ws") {
        require(sender() == self.owner, "Only owner is allowed to withdraw");
        send(SendParameters {
            to:     sender(),
            bounce: true,
            value:  myBalance() - context().value - self.MinTonForStorage,
            mode:   SendRemainingValue + SendIgnoreErrors
        });
    }

    get fun id() : Int {
        return self.id;
    }

    // Функция для получения баланса контракта
    get fun balance(): Int {
        return myBalance();
    }

    get fun recalculateSumToGive(contextValue: Int): Int {
        return (contextValue - self.MinTonForStorage - (2 * self.ApproxGasForTransaction * self.recipientsAmount)) / self.recipientsAmount;
    }

    // Основная функция, которая вызывается для распределения средств
    get fun distribute(): Bool {
        if (self.recipientsAmount <= 0 || self.sumToGive >= myBalance()) {
            return false;
        }

        let recipient: Address? = self.recipients.get(self.currentIndex);
        if (recipient == null) {
            return false;
        }

        // Отправляем средства случайному получателю
        send(SendParameters {
            to:     recipient!!,
            bounce: true,
            value:  self.sumToGive,
            mode:   SendRemainingValue + SendIgnoreErrors
        });

        // Удаляем за собой адрес этого кошелька
        self.recipients.del(self.currentIndex);
        self.currentIndex     += 1;
        self.recipientsAmount -= 1;

        return true;
    }
}