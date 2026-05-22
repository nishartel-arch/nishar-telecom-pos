window.shareWhatsApp = function(
billItems,
total
){

const phone =
document.getElementById('customer-phone')
.value.trim();


// ITEMS TEXT

let itemsText='';

billItems.forEach(item=>{

itemsText +=
`${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;

});


// MESSAGE

const message =

`🧾 Nishar Telecom

📍 Srikhanda, Katwa

${itemsText}

💰 Total: ₹${total}

🙏 Thank you for visiting Nishar Telecom`;


// OPEN WHATSAPP

window.open(

`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`,

'_blank'

);

}