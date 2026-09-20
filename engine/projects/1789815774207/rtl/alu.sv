module alu (
    input  logic [7:0] a,
    input  logic [7:0] b,
    input  logic [2:0] op,

    output logic [7:0] result,
    output logic       zero,
    output logic       carry
);

    logic [8:0] temp;

    always_comb begin
        result = 8'h00;
        carry  = 1'b0;
        temp   = 9'h000;

        case (op)

            // ADD
            // INTENTIONAL BUG:
            // Carry should be temp[8], but is incorrectly forced to 0.
            3'b000: begin
                temp   = {1'b0, a} + {1'b0, b};
                result = temp[7:0];
                carry  = 1'b0;
            end

            // SUB
            3'b001: begin
                temp   = {1'b0, a} - {1'b0, b};
                result = temp[7:0];
                carry  = temp[8];
            end

            // AND
            3'b010: begin
                result = a & b;
            end

            // OR
            3'b011: begin
                result = a | b;
            end

            // XOR
            3'b100: begin
                result = a ^ b;
            end

            // NOT
            3'b101: begin
                result = ~a;
            end

            // SHIFT LEFT
            3'b110: begin
                result = a << 1;
            end

            // SHIFT RIGHT
            3'b111: begin
                result = a >> 1;
            end

            default: begin
                result = 8'h00;
                carry  = 1'b0;
            end

        endcase
    end

    // Result is zero
    assign zero = (result == 8'h00);

endmodule