// sudo npm install -g live-server  -> To install live server
// npx live-server --port=8000      -> To run live server

// Use Google to add Sepolia ETH (test funds) into your account
// Login To Metamask website/extension to show all the details on your website

let web3;

// Link your api key id 
const infuraUrl = 'https://sepolia.infura.io/v3/bfb609778e754b94a6ba35a9f7ecab75';
let walletBalance = 0.0; // razorpay balance
const transactions = [];
// Wallet Address
const receiverAddress = '0xB4d54f8538b2948B14761C150a60b46Ca8aD7847';

async function initializeWeb3() {
    console.log("Initializing Web3...");
    if (typeof window.ethereum === 'undefined') {
        console.error("MetaMask is required but not detected.");
        document.getElementById('connectionStatus').textContent = 'MetaMask Not Installed';
        document.getElementById('connectionStatus').className = 'text-danger';
        document.getElementById('ethBalance').textContent = 'MetaMask Required';
        return false;
    }

    web3 = new Web3(window.ethereum);
    const chainId = await web3.eth.getChainId();
    console.log("Current chain ID:", chainId);
    if (chainId !== 11155111) {
        console.error("Please switch MetaMask to Sepolia (Chain ID: 11155111)");
        document.getElementById('connectionStatus').textContent = 'Wrong Network';
        document.getElementById('connectionStatus').className = 'text-danger';
        return false;
    }
    console.log("Web3 initialized with MetaMask on Sepolia");
    return true;
}

async function connectMetaMask() {
    if (!web3) await initializeWeb3();

    if (!web3) return null;

    try {
        console.log("Requesting MetaMask accounts...");
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await web3.eth.getAccounts();
        console.log("Connected accounts:", accounts);
        if (accounts.length > 0) {
            document.getElementById('connectionStatus').textContent = 'Connected';
            document.getElementById('connectionStatus').className = 'text-success';
            await fetchEthBalance(accounts[0]);
            return accounts[0];
        } else {
            console.error("No accounts returned from MetaMask.");
            document.getElementById('connectionStatus').textContent = 'No Accounts';
            document.getElementById('connectionStatus').className = 'text-danger';
            return null;
        }
    } catch (error) {
        console.error("MetaMask connection error:", error.message);
        document.getElementById('connectionStatus').textContent = 'Connection Failed';
        document.getElementById('connectionStatus').className = 'text-danger';
        return null;
    }
}

async function fetchEthBalance(account) {
    try {
        if (!account) throw new Error("No account provided");
        console.log("Fetching balance for account:", account);
        const balanceWei = await web3.eth.getBalance(account);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        console.log("Raw balance (wei):", balanceWei);
        console.log("Sepolia ETH balance:", balanceEth);
        document.getElementById('ethBalance').textContent = `${parseFloat(balanceEth).toFixed(4)} ETH`;
    } catch (error) {
        console.error("Failed to fetch ETH balance:", error.message);
        document.getElementById('ethBalance').textContent = 'Error';
    }
}

async function recordOnBlockchain(amount, paymentId) {
    console.log("Recording test transaction...");
    const senderAccount = await connectMetaMask();
    if (!senderAccount) return null;

    try {
        const balanceWei = await web3.eth.getBalance(senderAccount);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        console.log("Current balance:", balanceEth, "ETH");

        const txData = `Test:${paymentId}`;
        const gasPriceWei = web3.utils.toWei('1', 'gwei'); // 1 Gwei in wei
        const gasLimit = 30000;
        const gasCostEth = web3.utils.fromWei((BigInt(gasPriceWei) * BigInt(gasLimit)).toString(), 'ether');
        console.log("Gas price (wei):", gasPriceWei);
        console.log("Gas limit:", gasLimit);
        console.log("Estimated gas cost:", gasCostEth, "ETH");

        if (parseFloat(balanceEth) < parseFloat(gasCostEth)) {
            throw new Error(`Insufficient funds: ${balanceEth} ETH available, need ${gasCostEth} ETH`);
        }

        const tx = {
            from: senderAccount,
            to: receiverAddress,
            value: '0', // Can be string or hex; Web3.js will convert
            gasPrice: gasPriceWei, // Web3.js will handle conversion
            gas: gasLimit, // Web3.js will handle conversion
            data: web3.utils.toHex(txData)
        };

        console.log("Prepared transaction:", tx);

        // Use web3.eth.sendTransaction instead of window.ethereum.request
        const receipt = await web3.eth.sendTransaction(tx);
        const txHash = receipt.transactionHash;
        console.log("Transaction submitted, txHash:", txHash);

        await fetchEthBalance(senderAccount);

        transactions.unshift({
            date: new Date().toISOString().split('T')[0],
            description: `Test Payment (ID: ${paymentId})`,
            amount: `₹${amount}`,
            status: "Pending",
            txHash: txHash,
            blockchainDetails: { txHash, data: txData }
        });
        loadTransactions();

        return { txHash, data: txData };
    } catch (error) {
        console.error("Blockchain error:", error.message);
        transactions.unshift({
            date: new Date().toISOString().split('T')[0],
            description: `Test Error: ${error.message}`,
            amount: "₹0.00",
            status: "Failed",
            txHash: null,
            blockchainDetails: null
        });
        loadTransactions();
        await fetchEthBalance(senderAccount);
        return null;
    }
}

function loadTransactions() {
    const tbody = document.getElementById('transactionHistory');
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No transactions yet</td></tr>';
    } else {
        transactions.forEach((transaction) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.date}</td>
                <td>${transaction.description}</td>
                <td class="${transaction.amount.startsWith('-') ? 'text-danger' : 'text-success'}">${transaction.amount}</td>
                <td><span class="badge ${transaction.status === 'Completed' ? 'bg-success' : 'bg-danger'}">${transaction.status}</span></td>
                <td>${transaction.txHash ? `<a href="https://sepolia.etherscan.io/tx/${transaction.txHash}" target="_blank">${transaction.txHash.substring(0, 10)}...</a>` : 'N/A'}</td>
            `;
            tbody.appendChild(row);

            const cardRow = document.createElement('tr');
            cardRow.innerHTML = `
                <td colspan="5">
                    <div class="card blockchain-card shadow-sm mb-2">
                        <div class="card-body">
                            <h6 class="card-title">Blockchain Process View</h6>
                            ${transaction.blockchainDetails ? `
                                <p class="card-text">
                                    <strong>Tx Hash:</strong> ${transaction.blockchainDetails.txHash || 'Pending'}<br>
                                    <strong>Data:</strong> ${transaction.blockchainDetails.data}
                                </p>
                            ` : `
                                <p class="card-text text-muted">No blockchain data available</p>
                            `}
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(cardRow);
        });
    }
}

document.querySelector('.payButton').addEventListener('click', async function() {
    const amount = document.getElementById('amount').value;

    if (!amount || amount <= 0) {
        transactions.unshift({
            date: new Date().toISOString().split('T')[0],
            description: "Invalid Amount Attempt",
            amount: "₹0.00",
            status: "Failed",
            txHash: null,
            blockchainDetails: null
        });
        loadTransactions();
        return;
    }

    const amountInPaise = amount * 100;

    var options = {
        key: 'rzp_test_RON6tSrjBgbF6h',
        amount: amountInPaise,
        currency: "INR",
        name: "Payment Dashboard",
        description: "Wallet Funding (Test)",
        image: 'https://i.imgur.com/n5tjHFD.jpg',
        handler: async function(response) {
            const paymentAmount = `+₹${parseFloat(amount).toFixed(2)}`;
            walletBalance += parseFloat(amount);
            document.getElementById('walletBalance').textContent = `₹${walletBalance.toFixed(2)}`;

            const blockchainDetails = await recordOnBlockchain(amount, response.razorpay_payment_id);

            transactions.unshift({
                date: new Date().toISOString().split('T')[0],
                description: "Test Wallet Funded (Payment ID: " + response.razorpay_payment_id + ")",
                amount: paymentAmount,
                status: blockchainDetails ? "Success" : "Failed",
                txHash: blockchainDetails ? blockchainDetails.txHash : null,
                blockchainDetails: blockchainDetails
            });

            loadTransactions();
        },
        prefill: {
            email: 'sohamgosavi06@gmail.com',
            contact: '7875151851'
        },
        notes: {
            address: 'Koregaon Park,Pune'
        },
        theme: {
            color: '#007bff'
        },
        "modal": {
            "ondismiss": function() {
                transactions.unshift({
                    date: new Date().toISOString().split('T')[0],
                    description: "Test Payment Cancelled",
                    amount: "₹0.00",
                    status: "Failed",
                    txHash: null,
                    blockchainDetails: null
                });
                loadTransactions();
            }
        }
    };

    var razorpay = new Razorpay(options);
    razorpay.on('payment.failed', function(response) {
        transactions.unshift({
            date: new Date().toISOString().split('T')[0],
            description: "Test Payment Failed: " + response.error.description,
            amount: "₹0.00",
            status: "Failed",
            txHash: null,
            blockchainDetails: null
        });
        loadTransactions();
    });

    razorpay.open();
});

document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log("Page loaded, initializing...");
        document.getElementById('walletBalance').textContent = `₹${walletBalance.toFixed(2)}`;
        loadTransactions();
        await connectMetaMask();
    } catch (error) {
        console.error("Page load error:", error.message);
        document.getElementById('walletBalance').textContent = 'Error';
        document.getElementById('ethBalance').textContent = 'Error';
    }
});