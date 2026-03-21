// Arquivo reservado para inicialização do Firebase.
// Futuramente: criar `firebaseConfig`, inicializar app e exportar `db`, `auth` e `storage`.

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCa7sATArPxmfdoYCo50gIcH9VkEIbMqMM",
  authDomain: "aquasense-b0ad9.firebaseapp.com",
  projectId: "aquasense-b0ad9",
  storageBucket: "aquasense-b0ad9.firebasestorage.app",
  messagingSenderId: "651608124721",
  appId: "1:651608124721:web:efdab8325b7edfe4fd5410"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
