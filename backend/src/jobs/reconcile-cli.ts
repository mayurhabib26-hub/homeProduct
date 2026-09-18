import { runReconciliation } from './reconcile.js';

const report = await runReconciliation();
const clean = report.paymentsWithoutOrder.length === 0 && report.amountMismatches.length === 0;

console.log('\nReconciliation');
console.log(`  stale orders released : ${report.staleReleased.length}`, report.staleReleased.join(' '));
console.log(`  stale orders recovered: ${report.staleRecovered.length}`, report.staleRecovered.join(' '));
console.log(`  payments checked      : ${report.checkedPayments}`);
console.log(`  payments with NO order: ${report.paymentsWithoutOrder.length}`, report.paymentsWithoutOrder.join(' '));
console.log(`  amount mismatches     : ${report.amountMismatches.length}`);
console.log(clean ? '\n  clean' : '\n  NEEDS ATTENTION');

process.exit(clean ? 0 : 1);
