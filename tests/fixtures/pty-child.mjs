process.stdin.setEncoding("utf8");
process.stdout.write("READY\n");

process.stdin.on("data", (data) => {
  const input = String(data);

  if (input.includes("EXIT")) {
    process.stdout.write("EXITING\n");
    process.exit(0);
  }

  process.stdout.write(`INPUT:${input}`);
});
