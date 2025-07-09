// This file ensures Firebase dependencies are included in the build
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

// Re-export for use in other files
export { initializeApp, getFirestore }
export * from "firebase/firestore"
