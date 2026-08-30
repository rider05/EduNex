const fs = require('fs');
const filePath = 'd:\\edunex\\app\\screens\\students\\modals\\PaymentModal.js';
let code = fs.readFileSync(filePath, 'utf8');

// Replace the start of the component state cleanly
const targetSnippet = `  const [selectedBank, setSelectedBank] = useState("hdfc");
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");
  const [paymentConfig, setPaymentConfig] = useState({
    upiId: "-",
    merchantName: "-",
    merchantCode: "-",
    bankName: "-",
    encryptionStatus: "AES-256 Secured Ledger",
  // Animation values`;

const replacementSnippet = `  const [selectedBank, setSelectedBank] = useState("hdfc");
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");
  const [paymentConfig, setPaymentConfig] = useState({
    upiId: "-",
    merchantName: "-",
    merchantCode: "-",
    bankName: "-",
    encryptionStatus: "AES-256 Secured Ledger",
  });

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [saveCard, setSaveCard] = useState(true);

  // Breakdown drawer state
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Camera QR scanner state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Generated transaction details
  const [txnDetails, setTxnDetails] = useState(null);

  // Animation values`;

if (code.includes(targetSnippet)) {
  code = code.replace(targetSnippet, replacementSnippet);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Successfully patched PaymentModal.js states!');
} else {
  console.log('Target snippet not found in PaymentModal.js');
}
