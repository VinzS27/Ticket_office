const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

const S = 100;
const T = 150;
const C = 200;
let NS,NT,NC = 0;
let SNS,SNT,SNC = 0;
let customerName = '';
let ticketAvailability;
const lockTickets =[];

io.on('connection', (socket) => {
  console.log('Client connected');
  ticketAvailability = require('./tickets.json');

  socket.on('setName', (name) => {
    customerName = name;
    socket.emit('nameConfirmed', 'OK');
    console.log('name confirmed.');
  });

  socket.on('getTickets', () => {
    fs.readFile('purchaseLog.txt', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        socket.emit('ticketAvailability', {S, T, C, SNS, SNT, SNC });
      } else {
        // Leggi le informazioni sui biglietti dal file JSON
        NS = ticketAvailability.stadio;
        NT = ticketAvailability.teatro;
        NC = ticketAvailability.concerto;

        //divide per righe,toglie eventuali righe vuote(false)
        //mappa le righe rimaste, divide i token separandoli
        //dalla virgola e ritorna l'array di oggetti
        const purchaseData = data.split('\n').filter(Boolean).map((row) => {
          const [name, type, quantity] = row.split(',');
          return { name, type, quantity: parseInt(quantity) };
        });
  
        //Filtra i dati sugli acquisti in base al nome del 
        //cliente e ritorna l'array
        const customerPurchases = purchaseData.filter((purchase) => {
          return purchase.name === customerName;
        });
  
        //conta la somma delle quantità di acquisti per categorie 
        //SNS, SNT e SNC conterranno la somma delle quantità
        const purchasedTickets = customerPurchases.reduce((sum, purchase) => {
          if (purchase.type === 'NS') sum.SNS += purchase.quantity;
          else if (purchase.type === 'NT') sum.SNT += purchase.quantity;
          else if (purchase.type === 'NC') sum.SNC += purchase.quantity;
          return sum;
        }, { SNS: 0, SNT: 0, SNC: 0 });

        SNS = purchasedTickets.SNS;
        SNT = purchasedTickets.SNT;
        SNC = purchasedTickets.SNC;
  
        // Aggiorna biglietti acquistati/disponibili
        socket.emit('ticketAvailability', {NS,NT,NC,...purchasedTickets});
      }
    });
  });

  socket.on('buyTickets', ({ type, quantity }) => {
    let message = '';
    //controllo stringa vuota, simboli, e valore >=1
    if(/^\d+$/.test(quantity) && parseInt(quantity) >= 1){
      //la quantità non deve essere > del totale biglietti dispnibili
      if (type == 'NS' && quantity <= NS || type == 'NT' && quantity <= NT
          || type == 'NC' && quantity <= NC){
            //blocca i biglietti per l'utente
            lockTickets.push({ name: customerName, type, quantity });
            message = 'OK';
      }else
        message = 'fail';
    }else
      message = 'Error';
    
    //Invio conferma ok o fail
    socket.emit('purchaseConfirmation', message);
    
    //Conferma positiva
    socket.on('positiveConfirmation', (message) => {
    if (message === 'OK') {
      // Rimuovo tutte le richieste di acquisto in sospeso con lo stesso nome del cliente
      const remove = lockTickets.filter((request) => request.name === customerName);
      remove.forEach((request) => {
      const index = lockTickets.indexOf(request);
      if (index !== -1)
        lockTickets.splice(index, 1);
      });  
      
      if (type == 'NS') { NS -= quantity; }
      else if (type == 'NT'){ NT -= quantity;}
      else if (type == 'NC') { NC -= quantity;}
      console.log(message);

      //aggiorno i biglietti venduti/disponibili
      io.sockets.emit('ticketAvailability', {NS, NT, NC});
      //salvo per nominativo in un file
      savePurchaseInfo({name: customerName, type, quantity,});
    }else
      //fallisce
      console.log('fail');
    });
  });
   
  socket.on('removeTickets', ({ type, quantity }) => {
    let message = '';
    //controllo stringa vuota, simboli, e valore >=1
    if (/^\d+$/.test(quantity) && parseInt(quantity) >= 1) {
      if (type == 'NS' && quantity <= SNS) { //controllo che cliente abbia questi biglietti
        SNS -= quantity; // Rimuovi i biglietti acquistati
        //evito di sforare un quantità fissata
        NS = ((NS+quantity || NS) >= S) ? S : (NS+quantity); 
        message = 'OK';
      } else if (type == 'NT' && quantity <= SNT) {
        SNT -= quantity;
        NT = ((NT+quantity || NT) >= T) ? T : (NT+quantity);
        message = 'OK';
      } else if (type == 'NC' && quantity <= SNC) {
        SNC -= quantity;
        NC = ((NC+quantity || NC) >= C) ? C : (NC+quantity);
        message = 'OK';
      }else{ message='fail'; }
      }else{ message='fail'; }

      //invia la conferma 
      socket.emit('removeConfirmation', message);
      socket.on('positiveRemConf', (message) => {
      if(message === 'OK'){
        console.log('Ok on remove.')
        io.sockets.emit('ticketAvailability', { NS, NT, NC, SNS, SNT, SNC });
        
        //salvo con segno meno così alla lettura del file il conto sarà giusto.
        savePurchaseInfo({name: customerName, type, quantity:-quantity,});
      }else console.log('fail on remove.');
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    saveTicketAvailability();
  });
 });

 //tiene aggiornate le info sui clienti
function savePurchaseInfo(purchaseInfo) {
  fs.open('purchaseLog.txt', 'a', (err, fd) => {
    if (err) {
      console.error('Error in open: ' + err);
    } else {
      const string = `${purchaseInfo.name},${purchaseInfo.type},${purchaseInfo.quantity}\n`;
      fs.appendFile(fd, string, (appendErr) => {
        if (appendErr) {
          console.error('Error in append: ' + appendErr);
        } else {
          console.log('Saved.');
        }

        fs.close(fd, (closeErr) => {
          if (closeErr) {
            console.error('Error in close: ' + closeErr);
          }
        });
      });
    }
  });
}

//tiene aggiornato la disponibilità dei biglietti
function saveTicketAvailability() {
  ticketAvailability.stadio = NS;
  ticketAvailability.teatro = NT;
  ticketAvailability.concerto = NC;

  fs.writeFile('tickets.json', JSON.stringify(ticketAvailability, null, 2), (err) => {
    if (err) {
      console.error('Errore: ' + err);
    } else {
      console.log('tickets salvati JSON.');
    }
  });
}

app.use(express.static(__dirname));

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
