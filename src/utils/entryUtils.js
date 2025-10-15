/**
 * Utility functions for entry calculations and management
 */

/**
 * Calculate the number of entries a customer should receive for a purchase
 * @param {number} totalPrice - The total price of the purchase
 * @param {number} entriesPerDollar - How many entries per dollar spent
 * @param {number} maxEntries - Maximum entries allowed per customer
 * @returns {number} - The number of entries to award (capped at maxEntries)
 */
const calculatePurchaseEntries = (totalPrice, entriesPerDollar = 1, maxEntries = 1000) => {
  const calculatedEntries = Math.floor(totalPrice * entriesPerDollar);
  return Math.min(calculatedEntries, maxEntries);
};

/**
 * Get the maximum entries allowed per customer
 * @returns {number} - Maximum entries from environment variable
 */
const getMaxEntriesPerCustomer = () => {
  return parseInt(process.env.MAX_ENTRIES_PER_CUSTOMER) || 1000;
};

/**
 * Get entries for AMOE (Alternative Method of Entry - No Purchase Necessary)
 * @returns {number} - Maximum entries for AMOE participants
 */
const getAMOEEntries = () => {
  return getMaxEntriesPerCustomer();
};

/**
 * Check if a customer has reached the maximum entries for a promo
 * @param {Array} existingEntries - Array of existing entries for the customer
 * @param {number} maxEntries - Maximum entries allowed
 * @returns {Object} - { hasReachedMax: boolean, currentTotal: number, canAddMore: boolean }
 */
const checkEntryLimit = (existingEntries, maxEntries = null) => {
  const maxAllowed = maxEntries || getMaxEntriesPerCustomer();
  const currentTotal = existingEntries.reduce((sum, entry) => sum + entry.entry_count, 0);
  
  return {
    hasReachedMax: currentTotal >= maxAllowed,
    currentTotal,
    canAddMore: currentTotal < maxAllowed,
    remainingEntries: Math.max(0, maxAllowed - currentTotal)
  };
};

/**
 * Calculate how many entries to add for a new purchase
 * @param {number} purchaseAmount - Amount of the purchase
 * @param {Array} existingEntries - Existing entries for the customer
 * @param {number} entriesPerDollar - Entries per dollar
 * @param {number} maxEntries - Maximum entries allowed
 * @returns {number} - Number of entries to add (considering limits)
 */
const calculateEntriesToAdd = (purchaseAmount, existingEntries, entriesPerDollar = 1, maxEntries = null) => {
  const maxAllowed = maxEntries || getMaxEntriesPerCustomer();
  const entryLimit = checkEntryLimit(existingEntries, maxAllowed);
  
  if (entryLimit.hasReachedMax) {
    return 0; // Customer has already reached max entries
  }
  
  const calculatedEntries = Math.floor(purchaseAmount * entriesPerDollar);
  const entriesToAdd = Math.min(calculatedEntries, entryLimit.remainingEntries);
  
  return entriesToAdd;
};

module.exports = {
  calculatePurchaseEntries,
  getMaxEntriesPerCustomer,
  getAMOEEntries,
  checkEntryLimit,
  calculateEntriesToAdd
};
