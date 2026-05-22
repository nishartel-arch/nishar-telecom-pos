window.generatePDF = function(billItems,total){

const { jsPDF } = window.jspdf;

const doc = new jsPDF();


// HEADER

doc.setFontSize(22);

doc.text(
'Nishar Telecom',
20,
20
);

doc.setFontSize(12);

doc.text(
'Srikhanda, Katwa, Purba Bardhaman',
20,
30
);

doc.text(
'Phone: 8918881010',
20,
38
);

doc.text(
`Date: ${new Date().toLocaleString()}`,
20,
46
);


// TABLE HEADER

let y = 65;

doc.setFontSize(14);

doc.text('Product',20,y);
doc.text('Qty',100,y);
doc.text('Price',130,y);
doc.text('Total',170,y);

y += 10;


// ITEMS

billItems.forEach(item=>{

const totalPrice =
item.price * item.qty;

doc.text(item.name,20,y);

doc.text(
String(item.qty),
100,
y
);

doc.text(
`₹${item.price}`,
130,
y
);

doc.text(
`₹${totalPrice}`,
170,
y
);

y += 10;

});


// GRAND TOTAL

y += 10;

doc.setFontSize(18);

doc.text(
`Grand Total: ₹${total}`,
20,
y
);


// FOOTER

y += 20;

doc.setFontSize(12);

doc.text(
'Thank You For Visiting Nishar Telecom',
20,
y
);


// SAVE PDF

doc.save(
`Invoice-${Date.now()}.pdf`
);

}