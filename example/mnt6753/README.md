To test it you can go to the directory example/mnt6753 and run a web server on this directory http-server .
Connect to https://127.0.0.1:8080
Open the DevTools Ctrl-Shift-i
In the console you can run t = generateTestCase() to generate a test case. (It can take a few seconds).
To test my implementation: boweGabizonVerifier(t.verificationKey, t.input, t.proof)
To use the reference implementation: ref_boweGabizonVerifier(t.verificationKey, t.input, t.proof)

