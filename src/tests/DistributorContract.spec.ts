import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Dictionary } from '@ton/core';
import { DistributorContract } from '../wrappers/DistributorContract';
import '@ton/test-utils';

describe('DistributorContract', () => {
    let blockchain: Blockchain;
    let distributorContract: SandboxContract<DistributorContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        const recipient1 = await blockchain.treasury('recipient1');
        const dict = Dictionary.empty(Dictionary.Keys.BigInt(32), Dictionary.Values.Address())
        dict.set(0n, recipient1.address)

        distributorContract = blockchain.openContract(await DistributorContract.fromInit(0n, dict, 1n));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await distributorContract.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: distributorContract.address,
            deploy: true,
            success: true,
        });

        await distributorContract.send(
            deployer.getSender(),
            {
                value: toNano("500")
            }, null
        );
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and distributorContract are ready to use
    });

    it.skip("should withdraw all", async()=>{
        const deployer = await blockchain.treasury('deployer');
        const user     = await blockchain.treasury('user');
        
        const balanceBeforeUser = await user.getBalance();
        
        await distributorContract.send(user.getSender(), {
            value: toNano("0.2")
        }, 'wa')

        const balanceAfterUser = await user.getBalance();

        expect(balanceAfterUser).toBeLessThanOrEqual(balanceBeforeUser)

        const balanceBeforeDeployer = await deployer.getBalance()

        await distributorContract.send(deployer.getSender(), {
            value: toNano("0.2")
        }, 'wa')

        const balanceAfterDeployer = await deployer.getBalance()

        expect(balanceAfterDeployer).toBeGreaterThan(balanceBeforeDeployer)
    });

    it("should withdraw safe", async()=>{
        const deployer = await blockchain.treasury('deployer');
        const user     = await blockchain.treasury('user');
        
        const balanceBeforeUser = await user.getBalance()
        
        await distributorContract.send(user.getSender(), {
            value: toNano("0.2")
        }, 'ws')

        const balanceAfterUser = await user.getBalance()

        expect(balanceBeforeUser).toBeGreaterThanOrEqual(balanceAfterUser)

        const balanceBeforeDeployer = await deployer.getBalance()

        await distributorContract.send(deployer.getSender(), {
            value: toNano("0.2")
        }, 'ws')

        await delay(1000);

        const balanceAfterDeployer = await deployer.getBalance()

        console.log("balanceBeforeDeployer - ", balanceBeforeDeployer);
        console.log("balanceAfterDeployer - ", balanceAfterDeployer);

        expect(balanceAfterDeployer).toBeGreaterThan(balanceBeforeDeployer)
    
        const contractBalance = await distributorContract.getBalance()

        expect(contractBalance).toBeGreaterThan(0n)
    });

    it.skip("should do the work", async()=>{
        const deployer   = await blockchain.treasury('deployer');
        const recipient1 = await blockchain.treasury('recipient1');

        const balanceBeforeRecipient = await recipient1.getBalance();

        await distributorContract.send(deployer.getSender(), {
            value: toNano("0.2")
        }, 'g')

        const balanceAfterRecipient = await recipient1.getBalance();

        expect(balanceAfterRecipient).toBeGreaterThan(balanceBeforeRecipient);
    });

    it.skip("shouldn't do the work (zero recipients)", async()=>{
        const deployer   = await blockchain.treasury('deployer');
        const recipient1 = await blockchain.treasury('recipient1');

        // step 1

        let balanceBeforeRecipient = await recipient1.getBalance();

        var result = await distributorContract.send(deployer.getSender(), {
            value: toNano("0.2")
        }, 'g');

        let balanceAfterRecipient = await recipient1.getBalance();

        expect(balanceAfterRecipient).toBeGreaterThan(balanceBeforeRecipient);

        // step 2

        balanceBeforeRecipient = await recipient1.getBalance();

        await distributorContract.send(deployer.getSender(), {
            value: toNano("0.2")
        }, 'g')

        balanceAfterRecipient = await recipient1.getBalance();

        expect(balanceAfterRecipient).toEqual(balanceBeforeRecipient);
    });
});

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}