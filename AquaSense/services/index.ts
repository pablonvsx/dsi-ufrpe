/**
 * Barrel de serviços - Exporta todos os módulos de negócio
 */

// Firestore Collections
export * as coletas from "./coletas";
export * as users from "./firestore/users";
export * as waterBodies from "./firestore/water_bodies";
export * as contributions from "./firestore/contributions";
export * as complaints from "./firestore/complaints";
export * as alerts from "./firestore/alerts";

// Storage & Files
export * as storage from "./storage/supabaseStorage";

// Utilities
export * as ambientalInfo from "./ambientalInfo";
export * as contributionHelper from "./contributionHelper";
export * as geo from "./geoService";
export * as email from "./emailService";