module alu_tb;

    logic [7:0] a;
    logic [7:0] b;
    logic [2:0] op;

    logic [7:0] result;
    logic       zero;
    logic       carry;

    // Connect testbench to ALU
    alu dut (
        .a      (a),
        .b      (b),
        .op      (op),
        .result (result),
        .zero   (zero),
        .carry  (carry)
    );

    initial begin

        // Waveform generation
        $dumpfile("alu.vcd");
        $dumpvars(0, alu_tb);

        $display("");
        $display("======================================");
        $display("       SILICON SENTINEL ALU TEST");
        $display("======================================");
        $display("");

        // --------------------------------
        // TEST 1: ADD
        // --------------------------------
        a = 8'd10;
        b = 8'd20;
        op = 3'b000;
        #1;

        $display(
            "ADD : %0d + %0d = %0d | carry=%b",
            a, b, result, carry
        );

        // --------------------------------
        // TEST 2: SUB
        // --------------------------------
        a = 8'd30;
        b = 8'd10;
        op = 3'b001;
        #1;

        $display(
            "SUB : %0d - %0d = %0d | carry=%b",
            a, b, result, carry
        );

        // --------------------------------
        // TEST 3: AND
        // --------------------------------
        a = 8'hFF;
        b = 8'h0F;
        op = 3'b010;
        #1;

        $display(
            "AND : %h & %h = %h",
            a, b, result
        );

        // --------------------------------
        // TEST 4: OR
        // --------------------------------
        op = 3'b011;
        #1;

        $display(
            "OR  : %h | %h = %h",
            a, b, result
        );

        // --------------------------------
        // TEST 5: XOR
        // --------------------------------
        op = 3'b100;
        #1;

        $display(
            "XOR : %h ^ %h = %h",
            a, b, result
        );

        // --------------------------------
        // TEST 6: NOT
        // --------------------------------
        a = 8'hAA;
        op = 3'b101;
        #1;

        $display(
            "NOT : ~%h = %h",
            a, result
        );

        // --------------------------------
        // TEST 7: SHIFT LEFT
        // --------------------------------
        a = 8'b00000001;
        op = 3'b110;
        #1;

        $display(
            "SHL : %b -> %b",
            a, result
        );

        // --------------------------------
        // TEST 8: SHIFT RIGHT
        // --------------------------------
        a = 8'b10000000;
        op = 3'b111;
        #1;

        $display(
            "SHR : %b -> %b",
            a, result
        );

        // --------------------------------
        // TEST 9: ZERO FLAG
        // --------------------------------
        a = 8'd10;
        b = 8'd10;
        op = 3'b001;
        #1;

        $display(
            "ZERO: %0d - %0d = %0d | zero=%b",
            a, b, result, zero
        );

        // --------------------------------
        // TEST 10: OVERFLOW / CARRY
        // --------------------------------
        // 255 + 1 = 256
        //
        // 8-bit result should wrap to 0
        // Carry should be 1
        // --------------------------------

        a = 8'hFF;
        b = 8'h01;
        op = 3'b000;
        #1;

        $display("");
        $display("--------------------------------------");
        $display("       FAILURE CAMPAIGN TEST");
        $display("--------------------------------------");

        $display(
            "OVERFLOW: %0d + %0d = %0d | carry=%b",
            a, b, result, carry
        );

        // Check expected behavior
        if (result != 8'h00 || carry != 1'b1) begin

            $display("");
            $display("!!! SILICON SENTINEL FAILURE DETECTED !!!");
            $display("");
            $display("Module      : alu");
            $display("Operation   : ADD");
            $display("Input A     : 0x%h", a);
            $display("Input B     : 0x%h", b);
            $display("");
            $display("EXPECTED");
            $display("Result      : 0x00");
            $display("Carry       : 1");
            $display("");
            $display("ACTUAL");
            $display("Result      : 0x%h", result);
            $display("Carry       : %b", carry);
            $display("");
            $display("Risk        : HIGH");
            $display("Status      : FAILURE");
            $display("");

        end
        else begin

            $display("");
            $display("PASS: Overflow behavior correct.");
            $display("");

        end

        // --------------------------------
        // END
        // --------------------------------

        $display("======================================");
        $display("          TEST COMPLETE");
        $display("======================================");

        $finish;

    end

endmodule