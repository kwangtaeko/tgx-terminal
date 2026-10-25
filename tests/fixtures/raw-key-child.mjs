process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write("READY");

process.stdin.once("data", (data) => {
  process.stdout.write(`RX:${Buffer.from(data).toString("hex")}`);
  process.exit(0);
});
