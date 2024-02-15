const socket = io();

//elementi da html
const errorElement = document.getElementById("error");
const stadiumTickets = document.getElementById("stadiumTickets");
const theatreTickets = document.getElementById("theatreTickets");
const concertTickets = document.getElementById("concertTickets");
const sPurchased = document.getElementById("sPurchased");
const tPurchased = document.getElementById("tPurchased");
const cPurchased = document.getElementById("cPurchased");
const ticketType = document.getElementById("ticketType");
const quantityInput = document.getElementById("quantity");
const confirmationMessage = document.getElementById("confirmationMessage");

//spostamento tra pagine html
function redirectToTickets() { window.location.href = 'tickets.html';}
function redirectToIndex() { window.location.href = 'index.html'; }

//invio di nome+cognome
function setName() {
  const nameInput = document.getElementById("nameInput");
  const lastnameInput = document.getElementById("lastNameInput");
  var name = nameInput.value + ' ' + lastnameInput.value;

  // Verifica se la stringa è vuota o ha simboli/punteggiatura
  if (name.trim() == "" || /[^A-Za-zÀ-ÖØ-öø-ÿ\s']/.test(name)) {
    errorElement.textContent = "Inserimento dati non corretto.";
  }else{
    errorElement.textContent = ""; // Cancella i messaggi di errore precedenti
    socket.emit('setName', name);
    socket.on('nameConfirmed', (message) => {
      if(message === 'OK')
        redirectToTickets();
      else
        alert('Nome non confermato.');
    });
  }
}

//aggiorna i biglietti disponibili/acquistati
function updateTicket() {
  socket.emit('getTickets');
  socket.on('ticketAvailability', (data) => {
    stadiumTickets.textContent = data.NS;
    theatreTickets.textContent = data.NT;
    concertTickets.textContent = data.NC;
    sPurchased.textContent = data.SNS;
    tPurchased.textContent = data.SNT;
    cPurchased.textContent = data.SNC;
  });
}

//invio della richiesta d'acquisto
function buyTickets() {
  const type = ticketType.value;
  const quantity = parseInt(quantityInput.value);
  socket.emit('buyTickets', { type, quantity });
}

//Conferma d'acquisto
socket.on('purchaseConfirmation', (message) => {
  if (message === 'OK'){
    socket.emit('positiveConfirmation', message);
    alert("Acquisto riuscito!");
    redirectToIndex();
  }else if(message === 'fail'){
    alert("Biglietti in esaurimento!\nProva l'acquisto con un numero inferiore \no rinuncia a qualche biglietto già acquistato.");
    location.reload(true);
  }else{
    alert("Seleziona almeno un biglietto.");
    location.reload(true);
  }
});

//invio richiesta rinuncia a biglietti comprati
function removeTickets(){
  const type = ticketType.value;
  const quantity = parseInt(quantityInput.value);
  socket.emit('removeTickets', { type, quantity });
}
//Conferma rimozione
socket.on('removeConfirmation', (message) => {
  if (message === 'OK'){
    socket.emit('positiveRemConf',message);
    location.reload(true);
    alert("Biglietti rimossi!");
  }else{
    alert("Seleziona una giusta quantità.");
    location.reload(true);
  }
});

socket.on('connect', () => {
  updateTicket();
});
