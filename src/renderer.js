// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// nodeIntegration is turned on. All Node.js api can be used in 
// this file.

// Network programming finnal project
// Author: Qiuran Hu, Junior at Southeast University
("use strict");
let name;
let users = [];
const homeDir = require('os').homedir();
const directory = `${homeDir}/Desktop/`;
let addCountMap = new Map();
const groups = [];
const filesMap = new Map();
const messageMap = new Map();
let currentContact = null;
const fileBuffer = new Map();
let fileID = 0;
let os = require("os");
let ifaces = os.networkInterfaces();

//Set up  a UDP multicast client.
// Get the ip address.
let HOST = ""; //IP address of the client.
Object.keys(ifaces).forEach(function (ifname) {
  let alias = 0;
  ifaces[ifname].forEach(function (iface) {
    if ("IPv4" !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }
    if (alias >= 1) {
      // this single interface has multiple ipv4 addresses
      // console.log(ifname + ':' + alias, iface.address);
      HOST = iface.address;
    } else {
      // this interface has only one ipv4 adress
      // console.log(ifname, iface.address);
      HOST = iface.address;
    }
    ++alias;
  });
});
const multicastAddress = "230.1.1.1"; //Same multicast address as Server
const multicastPort = 55275;

document.addEventListener('DOMContentLoaded', function () {
  const elems = document.querySelectorAll('.modal');
  const instances = M.Modal.init(elems, {dismissible: true});
  const userNameInputModal = document.getElementById("modal2");
  M.Modal.init(userNameInputModal, {dismissible: false});
  const instance = M.Modal.getInstance(userNameInputModal);

  instance.open();

  document.getElementsByClassName("create-name-button")[0].addEventListener("click", () => {
    const nameInputValue = document.getElementById("user-name-input").value;
    if(nameInputValue === "") {
      M.toast({html: 'User name cannot be empty!',displayLength: 1000});
      return;
    }
    name = nameInputValue;
    getUsers();
    instance.close();
  });

});

const dgram = require("dgram");
const { group } = require("console");
const UDPClient = dgram.createSocket("udp4");
UDPClient.on("listening", function () {
  const address = UDPClient.address();
  // console.log(
  //   "UDP Client listening on " + address.address + ":" + address.port
  // );
  UDPClient.setMulticastTTL(64);
  UDPClient.addMembership(multicastAddress);
});
// Set up the UDP multicast server.
// console.log("send message");
const UDPserver = dgram.createSocket("udp4");
UDPserver.bind(multicastPort);
UDPserver.on("listening", function () {
  this.setMulticastTTL(64);
  this.addMembership(multicastAddress);
});

/*********************************************functions start*********************************************/
// createMessageOnUI creates a message bubble on the user interface using the type of the message,
// the message text and the date.
function createMessageOnUI(type, text, date, isFile) {
  let dateText = date.toLocaleDateString() + " " + date.toLocaleTimeString();
  if (type === "received") {
    dateText += " Received";
  } else if (type === "sent") {
    dateText += " Sent";
  }
  const messageContainerElement = document.createElement("div");
  const dateContainerElement = document.createElement("div");
  if (type === "sent") {
    dateContainerElement.classList.add("message-date-sent");
  }
  const dateTextElement = document.createElement("div");
  if (type === "received") {
    dateTextElement.classList.add("message-date-received-text");
  } else if (type === "sent") {
    dateTextElement.classList.add("message-date-sent-text");
  }
  const messageTextContainerElement = document.createElement("div");
  messageTextContainerElement.classList.add("message-text-container");
  if (type === "sent") {
    messageTextContainerElement.classList.add("message-text-sent-container");
  }
  const messageTextElement = document.createElement("div");
  if (type === "received") {
    messageTextElement.classList.add("message-text-received");
  } else if (type === "sent") {
    messageTextElement.classList.add("message-text-sent");
  }
  messageTextElement.appendChild(document.createTextNode(text));
  dateTextElement.appendChild(document.createTextNode(dateText));
  dateContainerElement.appendChild(dateTextElement);
  messageContainerElement.appendChild(dateContainerElement);
  messageTextContainerElement.appendChild(messageTextElement);
  messageContainerElement.appendChild(messageTextContainerElement);
  const messageContent = document.getElementsByClassName("messages-content")[0];
  messageContent.appendChild(messageContainerElement);
  messageContent.scrollTop = messageContent.scrollHeight;

}

// createMessageOnMessageMap creates a message record.
// user is the stringified version of an user object or an array of user objects, 
// which includes name, ipAddress and port.
function createMessageOnMessageMap(type, text, date, user, isFile) {
  if (messageMap.get(user) === undefined) {
    messageMap.set(user, {
      messages: []
    });
  }
  const messageArray = messageMap.get(user).messages;
  messageArray.push({
    type: type,
    text: text,
    date: date,
    user: user,
    isFile: isFile
  });
  // .log(messageMap);
}

// examine examines if the user passed in is the current user
function examine(user) {
  if(user.length !== undefined) {
    for(let singleUser of user) {
      if(examine(singleUser)) {
        return true;
      }
    }
    return false;
  }
  if (
    (user.name === name || user.name === name + " (myself)") &&
    user.port === multicastPort &&
    user.ipAddress === HOST
  ) {
    return true;
  }
  return false;
}
// changeURL changes \ to /
function changeURL(url) {
  // console.log(url);
  let newURL = "";
  for (let i = 0; i < url.length; i++) {
    if (url[i] !== "\\") {
      newURL += url[i];
    } else {
      newURL += '/';
    }
  }
  return newURL;
}

// sendFile send a file to users
function sendFile(fileUrl, users, fileName, groupName) {
  let idOfTheFile = fileID;
  fileID += 1;
  fileUrl = changeURL(fileUrl);
  const fs = require("fs");
  // console.log(fileUrl);
  fs.readFile(fileUrl, function (err, data) {
    // console.log(data);
    const sliceSize = 15000;
    let numberOfArray = Math.ceil(data.length / sliceSize);
    filesMap.set(idOfTheFile, { slices: [], fileName: fileName })
    let bufferArray = filesMap.get(idOfTheFile).slices;

    for (let i = 0; i < numberOfArray; i++) {
      if (i === numberOfArray - 1) {
        bufferArray.push(data.slice(i * sliceSize, data.length));
      } else {
        bufferArray.push(data.slice(i * sliceSize, (i + 1) * sliceSize));
      }
        const message = {
          usage: "Message File",
          to: users,
          numberOfSlices: numberOfArray,
          currentIndex: i,
          date: new Date(),
          data: bufferArray[i],
          name: name,
          fileName: fileName,
          idOfTheFile: idOfTheFile
        };
        if(users.length === 1) {
          message.to = users[0];
        }
        const messageStr = JSON.stringify(message);
        const msg = new Buffer.from(messageStr);
        // console.log(msg.length + " sent");
        setTimeout(() => {
          UDPserver.send(msg, 0, msg.length, multicastPort, multicastAddress);
        }, 40 * i);
    }
  });
  let usersString;
  
  if (groupName === undefined) {
    usersString = JSON.stringify(users[0]);
  } else {
    usersString = JSON.stringify({groupName:groupName});
  }
  createMessageOnMessageMap("sent", fileName, new Date(), usersString, true);
  if (usersString === currentContact) {
    createMessageOnUI("sent", fileName, new Date());
  }
}

// sendFileSlice send a specfic slice of the file (identified by fileID) to specfic users
function sendFileSlice(fileID, sliceIndex, users, i) {
  for (const user of users) {
    const message = {
      usage: "Message File",
      to: user,
      numberOfSlices: filesMap.get(fileID).slices.length,
      currentIndex: sliceIndex,
      date: new Date(),
      data: filesMap.get(fileID).slices[sliceIndex],
      name: name,
      fileName: filesMap.get(fileID).fileName,
      idOfTheFile: fileID
    };
    const messageStr = JSON.stringify(message);
    const msg = new Buffer.from(messageStr);
    // console.log(msg.length + " sent");
    setTimeout(() => {
      UDPserver.send(msg, 0, msg.length, multicastPort, multicastAddress);
    }, 40 * i);
  }
}

// addNewUser add a new user.
function addNewUser(newUser) {
  users.push(newUser);
  const a = document.createElement("a");
  let nameUi = newUser.name;
  if (isMyself(name, newUser.ipAddress, newUser.port)) {
    nameUi += " (myself)";
  }
  let text = document.createTextNode(nameUi);
  a.classList.add("collection-item");
  // <span class="new badge">4</span>
  let span = document.createElement("span");
  span.classList.add("new");
  span.classList.add("badge");
  span.innerHTML = '0';
  const addCount = () => {
    span.innerHTML = String(Number(span.innerHTML) + 1);
    span.style.display = 'block';
  }
  addCountMap.set(JSON.stringify(newUser), addCount);

  span.style.display = "none";
  a.appendChild(span);
  a.appendChild(text);

  const uiUsers = document.getElementsByClassName("users-collection-items")[0];
  uiUsers.appendChild(a);
  const fileMessage = document.getElementsByClassName("file-input")[0];
  fileMessage.addEventListener("change", (event) => {
    // console.log("changed");
    const fileCount = document.querySelector(".file-count");
    if (!fileMessage.files[0]) {
      fileCount.style.display = "none";
    }
    if (fileMessage.files[0] && fileMessage.files[0].name !== '') {
      fileCount.style.display = "block";
      fileCount.innerHTML = fileMessage.files.length;
      // console.log(fileMessage.files.length)
    }
  });
  a.onclick = () => {
    span.innerHTML = '0';
    span.style.display = 'none';
    if (currentContact !== JSON.stringify(newUser)) {
      currentContact = JSON.stringify(newUser);
      clearMessages();
      showMessages();
      document.getElementById("message").value = '';
      fileMessage.value = null;
      const fileCount = document.querySelector(".file-count");
      fileCount.style.display = "none";
    }

    document.getElementsByClassName("start-card")[0].style.display = "none";
    document.getElementsByClassName("chat-card")[0].style.display = "flex";
    document.getElementsByClassName("message-user")[0].innerHTML = newUser.name;
    if (isMyself(name, newUser.ipAddress, newUser.port)) {
      document.getElementsByClassName("message-user")[0].innerHTML += " (myself)";
    }
    
    document.getElementsByClassName("send-message-btn")[0].onclick = () => {
      // console.log("Send button clicked");
      const messageText = document.getElementById("message").value;
      // console.log("Text to send is: ");
      // console.log(messageText);
      // console.log();
      if (messageText.length !== 0) {
        // console.log("Sending the text.");
        // Send a message to the specific usesr.
        const message = {
          usage: "Message Text",
          to: newUser,
          text: messageText,
          date: new Date(),
          name: name
        };
        const messageStr = JSON.stringify(message);
        const msg = new Buffer.from(messageStr);
        UDPserver.send(msg, 0, msg.length, multicastPort, multicastAddress);
        createMessageOnMessageMap("sent", messageText, new Date(), JSON.stringify(newUser), false);
        if (currentContact === JSON.stringify(newUser)) {
          createMessageOnUI("sent", messageText, new Date(), false);
        }
        document.getElementById("message").value = null;
      }

      if (fileMessage.files[0] && fileMessage.files[0].name !== '') {
        sendFile(fileMessage.files[0].path, [newUser], fileMessage.files[0].name);
        // console.log(fileMessage.files[0].path);
        fileMessage.value = null;
        const fileCount = document.querySelector(".file-count");
        fileCount.style.display = "none";

      }
    };
  };
}

// addNewGroup add a new group.
function addNewGroup(newGroup) {
  groups.push(newGroup);
  const a = document.createElement("a");
  let nameUi = newGroup.groupName;
  let text = document.createTextNode(nameUi);
  a.classList.add("collection-item");
  a.appendChild(text);

  const span = document.createElement("span");
  span.classList.add("badge");
  const img = document.createElement("img");
  img.src = "./images/icons/settings-24px.svg";
  img.alt = "setting";
  // img.style.height = '1em';
  // img.style.width = '1em';
  span.appendChild(img);
  a.appendChild(span);
  const usersCollection = document.getElementsByClassName("edit-group-users-collection")[0];

  const addUserToEditGroupUsersCollection = (name, ipAddress, port) => {
    const a = document.createElement('a');
    a.classList.add("collection-item");
    a.classList.add("blue-text");
    a.classList.add("edit-group-user-item");
    const span = document.createElement('span');
    span.classList.add("badge");
    const img = document.createElement("img");
    img.src = './images/icons/clear-24px.svg';
    img.alt = 'delete';
    span.appendChild(img);
    const textNode = document.createTextNode(name);
    a.appendChild(span);
    a.appendChild(textNode);
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      let groupUsers = groups.filter((group) => group.groupName === nameUi)[0].users;
      if(groupUsers.length === 1) {
        M.toast({html: 'Last user in group cannot be deleted!',displayLength: 1000});
        return;
      }
      groups.filter((group) => group.groupName === nameUi)[0].users = groupUsers.filter((user) => {
        if(user.name === name && user.ipAddress === ipAddress && user.port === port) {
          return false;
        }
        return true;
      });
      a.style.display = 'none';
    });
    usersCollection.appendChild(a);
  }
  const updateEditUsers = () => {
    usersCollection.innerHTML = '';
    let groupUsers = groups.filter((group) => group.groupName === nameUi)[0].users;
    for(const user of groupUsers) {
      addUserToEditGroupUsersCollection(user.name, user.ipAddress, user.port);
    }
  }
  span.addEventListener("click", (event) => {
    event.stopPropagation();
    const editUsersModal = document.getElementById("modal3");
    const instance = M.Modal.getInstance(editUsersModal);
    updateEditUsers();
    instance.open();

  })
  const uiUsers = document.getElementsByClassName("groups-collection-items")[0];
  uiUsers.appendChild(a);
  const fileMessage = document.getElementsByClassName("file-input")[0];
  fileMessage.addEventListener("change", (event) => {
    // console.log("changed");
    const fileCount = document.querySelector(".file-count");
    if (!fileMessage.files[0]) {
      fileCount.style.display = "none";
    }
    if (fileMessage.files[0] && fileMessage.files[0].name !== '') {
      fileCount.style.display = "block";
      fileCount.innerHTML = fileMessage.files.length;
      // console.log(fileMessage.files.length)
    }
  });
  a.onclick = () => {
    // console.log(currentContact);
    if (currentContact !== JSON.stringify({groupName:newGroup.groupName})) {
      currentContact = JSON.stringify({groupName: newGroup.groupName});
      clearMessages();
      showMessages();
      document.getElementById("message").value = '';
      fileMessage.value = null;
      const fileCount = document.querySelector(".file-count");
      fileCount.style.display = "none";
    }

    document.getElementsByClassName("start-card")[0].style.display = "none";
    document.getElementsByClassName("chat-card")[0].style.display = "flex";
    document.getElementsByClassName("message-user")[0].innerHTML = newGroup.groupName;
    document.getElementsByClassName("send-message-btn")[0].onclick = () => {
      // console.log("Send button clicked");
      const messageText = document.getElementById("message").value;
      // console.log("Text to send is: ");
      // console.log(messageText);
      // console.log();
      if (messageText.length !== 0) {
        if (currentContact === JSON.stringify({groupName: newGroup.groupName})) {
          createMessageOnUI("sent", messageText, new Date(), false);
          createMessageOnMessageMap("sent", messageText, new Date(), JSON.stringify({groupName: newGroup.groupName}), false);
        }
        for (const user of newGroup.users) {
          // console.log("Sending the text.");
          // Send a message to the specific usesr.
          const message = {
            usage: "Message Text",
            to: user,
            text: messageText,
            date: new Date(),
            name: name
          };
          const messageStr = JSON.stringify(message);
          const msg = new Buffer.from(messageStr);
          UDPserver.send(msg, 0, msg.length, multicastPort, multicastAddress);
          
          
          document.getElementById("message").value = null;
        }
      }

      if (fileMessage.files[0] && fileMessage.files[0].name !== '') {
        const currentContactObject = JSON.parse(currentContact);
        sendFile(fileMessage.files[0].path, newGroup.users, fileMessage.files[0].name, currentContactObject.groupName);
        // console.log(fileMessage.files[0].path);
        fileMessage.value = null;
        const fileCount = document.querySelector(".file-count");
        fileCount.style.display = "none";
      }
    };
  };
}

// isMyself test if a user is myself
function isMyself(name, ipAddress, port) {
  if (ipAddress === HOST && port === multicastPort) {
    return true;
  }
  return false;
}

// clearMessages delete all messages on UI
function clearMessages() {
  const messageContent = document.getElementsByClassName("messages-content")[0];
  messageContent.innerHTML = '';
}

// showMessages show all messages of a specific user on UI 
function showMessages() {
  if (messageMap.get(currentContact) === undefined) {
    return;
  }
  for (let message of messageMap.get(currentContact).messages) {
    createMessageOnUI(message.type, message.text, message.date, message.isFile);
  }
}

// clearUsers delete all users
function clearUsers() {
  users = [];
  document.querySelector(".users-collection-items").innerHTML = '';
} 

function getUsers() {
  const message = {
    usage: "Get Users",
  };
  const messageStr = JSON.stringify(message);
  const msg = new Buffer.from(messageStr);
  UDPserver.send(msg, 0, msg.length, multicastPort, multicastAddress);
}
/*********************************************functions end*********************************************/


// /**
//  *  Send a message to get all users.
//  */
// const message = {
//   usage: "Get Users",
// };
// const messageStr = JSON.stringify(message);
// const msg = new Buffer.from(messageStr);

/**
 * Handle message.
 */
UDPClient.on("message", function (message, remote) {
  const messageObj = JSON.parse(message);
  // console.log(
  //   "Message From: " + remote.address + ":" + remote.port + " - " + message
  // );

  if (messageObj.usage === "Get Users") {
    // console.log(messageObj.usage);
    const myInfo = {
      usage: "User Information",
      name: name,
    };
    const myInfoStr = JSON.stringify(myInfo);
    const myInfoMsg = new Buffer.from(myInfoStr);
    UDPserver.send(
      myInfoMsg,
      0,
      myInfoMsg.length,
      multicastPort,
      multicastAddress
    );
  } else if (messageObj.usage === "User Information") {
    const newUser = {
      name: messageObj.name,
      ipAddress: remote.address,
      port: remote.port,
    };
    let isFound = false;
    console.log(users)
    for (let user of users) {
      if (
        (user.name === newUser.name &&
        user.ipAddress === newUser.ipAddress &&
        user.port === newUser.port) || isMyself(newUser.name, newUser.ipAddress, newUser.port)
      ) {
        
        isFound = true;
      }
    }
    // console.log(isFound)
    if (isFound === false) {
      // console.log("add new user")
      addNewUser(newUser);
      // console.log(`Users:`);
      // console.log(users);
    }
  } else if (messageObj.usage === "Message Text" && examine(messageObj.to)) {
    const user = JSON.stringify({
      name: messageObj.name,
      ipAddress: remote.address,
      port: remote.port,
    });

    createMessageOnMessageMap("received", messageObj.text, new Date(messageObj.date),
      user, false);
    if (user === currentContact) {
      createMessageOnUI("received", messageObj.text, new Date(messageObj.date));
    } else {
      addCountMap.get(user)();
    }
  } else if (messageObj.usage === "Message File") {
    const identifier = messageObj.name + remote.address + ":" + remote.port;
    // console.log(identifier);
    if (examine(messageObj.to)) {
      if (messageObj.currentIndex === 0) {
        fileBuffer.set(identifier, {
          name: messageObj.name,
          address: remote.address,
          port: remote.port,
          fileSlices: new Map(),
          rest: new Set(),
          isFinished: false,
          requestSliceMap: new Map(),
          fileSlicesTimes: new Map()
        });
      }
      const rest = fileBuffer.get(identifier).rest;
      fileBuffer.get(identifier).fileSlices.set(messageObj.currentIndex, Buffer.from(messageObj.data));
      if (rest.has(messageObj.currentIndex)) {
        rest.delete(messageObj.currentIndex);
      }
      // console.log(messageObj.numberOfSlices - fileBuffer.get(identifier).fileSlices.size);
      let currentBiggestIndex = 0;

      if (fileBuffer.get(identifier).fileSlices.size === messageObj.numberOfSlices) {

        if (fileBuffer.get(identifier).isFinished === false) {
          fileBuffer.get(identifier).isFinished = true;
          const user = JSON.stringify({
            name: messageObj.name,
            ipAddress: remote.address,
            port: remote.port,
          });
          createMessageOnMessageMap('received', messageObj.fileName, new Date(messageObj.date), user, true);
          if (user === currentContact) {
            createMessageOnUI('received', messageObj.fileName, new Date(messageObj.date));
          } else {
            addCountMap.get(user)();
          }
          const fileSlicesArray = [];
          for (let i = 0; i < messageObj.numberOfSlices; i++) {
            // console.log(i);
            // console.log(fileBuffer.get(identifier).fileSlices.get(i))
            if(fileBuffer.get(identifier).fileSlices.get(i)) {
              fileSlicesArray.push(fileBuffer.get(identifier).fileSlices.get(i));
            }
          }
          const newData = Buffer.concat(fileSlicesArray);
          const fs = require("fs");

          let wstream = fs.createWriteStream(changeURL(directory + messageObj.fileName));

          // wstream.on('finish', function () {
          //   console.log('file has been written');
          // });
          wstream.write(newData);
          wstream.close();
        }


      }
      else if (messageObj.currentIndex === messageObj.numberOfSlices - 1 ||
        (fileBuffer.get(identifier).fileSlices.size) / messageObj.numberOfSlices > 0.70 ||
        messageObj.numberOfSlices < 100) {
        const fileSlices = fileBuffer.get(identifier).fileSlices;

        if (currentBiggestIndex < messageObj.currentIndex) {
          for (let index = currentBiggestIndex; index <= messageObj.currentIndex; index += 1) {
            if (fileSlices.get(index) === undefined) {
              rest.add(index);
            }
          }
          currentBiggestIndex = messageObj.currentIndex;
        }
        const requestFileSlice = (index, requestIndex) => {
          const requestFileSliceMessage = {
            usage: "Request File Slice",
            name: name,
            to: {
              name: messageObj.name,
              port: remote.port,
              ipAddress: remote.address
            },
            idOfTheFile: messageObj.idOfTheFile,
            sliceID: index,
            requestIndex: requestIndex
          };
          const requestFileSliceMessageStr = JSON.stringify(requestFileSliceMessage);
          const requestFileSliceMessageObj = new Buffer.from(requestFileSliceMessageStr);
          setTimeout(() => {
            const fileSlicesTimes = fileBuffer.get(identifier).fileSlicesTimes;
            if((fileSlices.get(index) !== undefined)) {
              return;
            }
            if(fileSlicesTimes.get(index) === undefined) {
              fileSlicesTimes.set(index, new Date());
            } else if(new Date() - fileSlicesTimes.get(index) < 100) {
              return;
            }
            UDPserver.send(
            requestFileSliceMessageObj,
            0,
            requestFileSliceMessageObj.length,
            multicastPort,
            multicastAddress
          )}, 100 * requestIndex);
        }
        let requestIndex = 0;
        // let number = messageObj.numberOfSlices;
        // if(messageObj.currentIndex !== messageObj.numberOfSlices - 1) {
        //   number = messageObj.currentIndex;
        // }
        let num = 1;
        if(messageObj.numberOfSlices < 100) {
          num = 2;
        } else if((fileBuffer.get(identifier).fileSlices.size) / messageObj.numberOfSlices < 0.8) {
          num = 80;
        } else if((fileBuffer.get(identifier).fileSlices.size) / messageObj.numberOfSlices < 0.9) {
          num = 60;
        } else if(messageObj.numberOfSlices  - (fileBuffer.get(identifier).fileSlices.size)  < 20) {
          num = 1;
        } else if((fileBuffer.get(identifier).fileSlices.size) / messageObj.numberOfSlices < 0.95) {
          num = 10;
        }
        if (messageObj.currentIndex % 10 === 0) {
          for (let i of rest) {
            const fileSlices = fileBuffer.get(identifier).fileSlices;
            if (fileSlices.get(i) === undefined) {
              requestFileSlice(i, requestIndex);
              requestIndex += 1;
            }
          }
          requestFileSlice(messageObj.numberOfSlices - 1, requestIndex);
        }
      }
    }
  } else if (messageObj.usage === "Request File Slice" && examine(messageObj.to)) {
    sendFileSlice(messageObj.idOfTheFile, messageObj.sliceID, [{
      name: messageObj.name,
      ipAddress: remote.address,
      port: remote.port
    }], messageObj.requestIndex);
  }
});

UDPClient.bind(multicastPort, HOST);

// Set the add button functionality.
document.getElementsByClassName("add-button")[0].addEventListener('click', () => {
  document.getElementById("group-name").value = '';
  const userMap = new Map();
  // console.log("Add button clicked");
  const usersCollection = document.querySelector(".add-group-users-collection");
  // <a href="#!" class="collection-item blue-text">
  //   <span class="badge">
  //     <label>
  //       <input type="checkbox" class="filled-in" checked="checked" />
  //       <span></span>
  //     </label>
  //   </span>
  //   Alan
  // </a>

  
  usersCollection.innerHTML = '';
  const addUserToAddGroupUsersCollection = (name, ipAddress, port) => {
    userMap.set(JSON.stringify({ name: name, ipAddress: ipAddress, port: port }), true);
    const a = document.createElement('a');
    a.classList.add("collection-item");
    a.classList.add("blue-text");
    a.classList.add("add-group-user-item");
    const span = document.createElement('span');
    span.classList.add("badge");
    const label = document.createElement('label');
    const input = document.createElement("input");
    input.type = "checkbox";
    input.classList.add("filled-in");
    input.checked = "checked";
    input.classList.add("checkbox-blue");
    input.addEventListener("change", () => {
      userMap.set(JSON.stringify({ name: name, ipAddress: ipAddress, port: port }), input.checked);
    })
    const emptySpan = document.createElement("span");
    const textNode = document.createTextNode(name);
    label.appendChild(input);
    label.appendChild(emptySpan);
    span.appendChild(label);
    a.appendChild(span);
    a.appendChild(textNode);
    usersCollection.appendChild(a);
   
  }
  // addUserToAddGroupUsersCollection(name + " (myself)", HOST, multicastPort);
  for (const user of users) {
    if (examine(user)) {
      addUserToAddGroupUsersCollection(name + " (myself)", HOST, multicastPort);
    } else {
      addUserToAddGroupUsersCollection(user.name, user.ipAddress, user.port);
    }
  }
   const createGroupButton = document.getElementsByClassName("create-group-button")[0];
    createGroupButton.onclick = () => {
      // console.log(userMap);
      const users = [];
      for(let user of userMap.keys()) {
        if(userMap.get(user) === true) {
          users.push(JSON.parse(user));
        }
      }
      if(users.length === 0) {
        M.toast({html: 'At least one user must be selected!',displayLength: 1000});
        return;
      }
      const groupName = document.getElementById("group-name").value;
      if(groupName === "") {
        M.toast({html: 'Group Name cannot be empty!',displayLength: 1000});
        return;
      }
      else {
        for(const group of groups) {
          if(groupName === group.groupName) {
            M.toast({html: 'Group Name cannot be same as an exsiting group!',displayLength: 1000});
            return;
          }
        }
      }
      const newGroup = {
        groupName: document.getElementById("group-name").value,
        users: users,
      };
      addNewGroup(newGroup);
      let elem = document.querySelector('.modal');
      let instance = M.Modal.getInstance(elem);
      instance.close();
    }
})

/********************************************Refresh Button*********************************************/
document.getElementsByClassName("refresh-users-button")[0].onclick = () => {
  clearUsers();
  getUsers();
}