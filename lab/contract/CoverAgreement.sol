// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract CoverAgreement {
    address public immutable funder;
    address public immutable farmer;
    address public immutable oracle;
    uint16 public immutable firstYear;
    uint8 public immutable termYears;
    uint256 public immutable payPerYear;
    uint256 public reported;
    mapping(uint16 => bool) public done;
    mapping(uint16 => bool) public covered;

    event Funded(uint256 amount);
    event Reported(uint16 year, bool covered, uint16 bareDays, uint16 winterNdviX1000, uint256 paid);
    event Refunded(uint256 amount);

    constructor(address _farmer, address _oracle, uint16 _firstYear, uint8 _nYears, uint256 _payPerYear) payable {
        require(_nYears > 0 && _farmer != address(0) && _oracle != address(0), "bad terms");
        funder = msg.sender; farmer = _farmer; oracle = _oracle;
        firstYear = _firstYear; termYears = _nYears; payPerYear = _payPerYear;
        if (msg.value > 0) emit Funded(msg.value);
    }

    receive() external payable { emit Funded(msg.value); }

    function report(uint16 year, bool isCovered, uint16 bareDays, uint16 winterNdviX1000) external {
        require(msg.sender == oracle, "only oracle");
        require(year >= firstYear && year < firstYear + termYears, "outside agreement");
        require(!done[year], "already reported");
        done[year] = true; covered[year] = isCovered; reported++;
        uint256 paid = 0;
        if (isCovered) {
            paid = payPerYear < address(this).balance ? payPerYear : address(this).balance;
            if (paid > 0) { (bool ok, ) = farmer.call{value: paid}(""); require(ok, "pay failed"); }
        }
        emit Reported(year, isCovered, bareDays, winterNdviX1000, paid);
    }

    function refund() external {
        require(msg.sender == funder, "only funder");
        require(reported == termYears, "not finished");
        uint256 b = address(this).balance;
        (bool ok, ) = funder.call{value: b}(""); require(ok, "refund failed");
        emit Refunded(b);
    }
}
