/** Various utility functions */

export function fisherSort(arrayToSort : any[]) : any[] {
  // randomly sort the array () - Fisher Yates
  for (let i = arrayToSort.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * i);
    [arrayToSort[i], arrayToSort[j]] = [arrayToSort[j], arrayToSort[i]];  }
  return arrayToSort;
}
